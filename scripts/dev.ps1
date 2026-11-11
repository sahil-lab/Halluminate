[CmdletBinding()]
param(
    [ValidateSet('Install', 'Format', 'Build', 'Test', 'Up', 'Smoke', 'Verify', 'Status')]
    [string]$Action = 'Verify'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ComposeFile = Join-Path $ProjectRoot 'infra\docker\compose.yaml'
$EvidenceDir = Join-Path $ProjectRoot '.local\evidence'
$SecretFile = Join-Path $ProjectRoot '.local\secrets\db-password'
$ComposeArguments = @('compose', '-p', 'halluminate', '-f', $ComposeFile)

New-Item -ItemType Directory -Force -Path $EvidenceDir | Out-Null
$CommandLog = Join-Path $EvidenceDir 'commands.log'

function Invoke-Compose {
    param([Parameter(Mandatory)][string[]]$CommandArguments)

    $commandText = 'docker compose -p halluminate -f .\infra\docker\compose.yaml ' + ($CommandArguments -join ' ')
    Write-Host "`n> $commandText"
    Add-Content -LiteralPath $CommandLog -Value ("{0:o} START {1}" -f [DateTime]::UtcNow, $commandText)
    & docker @ComposeArguments @CommandArguments
    $exitCode = $LASTEXITCODE
    Add-Content -LiteralPath $CommandLog -Value ("{0:o} EXIT {1}" -f [DateTime]::UtcNow, $exitCode)
    if ($exitCode -ne 0) {
        throw "Command exited ${exitCode}: $commandText"
    }
}

function Initialize-LocalConfiguration {
    & docker info --format 'Docker server={{.ServerVersion}} OS={{.OSType}}'
    if ($LASTEXITCODE -ne 0) {
        throw 'Docker is not responsive. Start a Linux Docker engine, then retry.'
    }
    & docker compose version
    if ($LASTEXITCODE -ne 0) {
        throw 'Docker Compose v2 or newer is required.'
    }
    if (-not (Test-Path -LiteralPath $SecretFile)) {
        $existingVolume = & docker volume ls --quiet --filter 'name=^halluminate_postgres_data$'
        if ($LASTEXITCODE -ne 0) {
            throw 'Could not check whether the Halluminate database volume exists.'
        }
        if ($existingVolume) {
            throw 'Halluminate data exists but its password file is missing. Restore the original local secret; do not reset the database.'
        }
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $SecretFile) | Out-Null
        $random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        try {
            $bytes = New-Object byte[] 48
            $random.GetBytes($bytes)
            [System.IO.File]::WriteAllText($SecretFile, [Convert]::ToBase64String($bytes))
        }
        finally {
            $random.Dispose()
        }
        Write-Host 'Created the ignored local database secret (value not displayed).'
    }
    Invoke-Compose -CommandArguments @('config', '--quiet')
}

function Install-Dependencies {
    Invoke-Compose -CommandArguments @('run', '--rm', '--no-deps', 'node', 'npm', 'ci', '--no-audit', '--no-fund')
}

function Test-Frontend {
    Invoke-Compose -CommandArguments @('run', '--rm', '--no-deps', 'node', 'npm', 'run', 'format:check')
    Invoke-Compose -CommandArguments @('run', '--rm', '--no-deps', 'node', 'npm', 'run', 'build')
    Invoke-Compose -CommandArguments @('run', '--rm', '--no-deps', 'node', 'npm', 'test')
}

function Test-Backend {
    Invoke-Compose -CommandArguments @('up', '--detach', '--wait', '--wait-timeout', '120', 'db')
    Invoke-Compose -CommandArguments @(
        'run', '--rm', '--no-deps', 'java',
        'mvn', '--batch-mode', '--no-transfer-progress', '-f', 'services/api/pom.xml',
        '-l', '/workspace/.local/evidence/maven-verify.log', 'verify'
    )
}

function Start-Runtime {
    Invoke-Compose -CommandArguments @('up', '--detach', '--wait', '--wait-timeout', '180', 'db', 'api', 'web')
}

function Test-Smoke {
    try {
        Invoke-Compose -CommandArguments @(
            'up', '--detach', '--wait', '--wait-timeout', '180', '--no-deps', 'api-unavailable'
        )
        Invoke-Compose -CommandArguments @('run', '--rm', '--no-deps', 'e2e')
    }
    finally {
        Invoke-Compose -CommandArguments @('stop', 'api-unavailable')
    }
}

Push-Location -LiteralPath $ProjectRoot
try {
    Initialize-LocalConfiguration
    switch ($Action) {
        'Install' {
            Install-Dependencies
        }
        'Format' {
            Invoke-Compose -CommandArguments @('run', '--rm', '--no-deps', 'node', 'npm', 'run', 'format')
            Invoke-Compose -CommandArguments @(
                'run', '--rm', '--no-deps', 'java',
                'mvn', '--batch-mode', '--no-transfer-progress', '-f', 'services/api/pom.xml', 'spotless:apply'
            )
        }
        'Build' {
            Install-Dependencies
            Invoke-Compose -CommandArguments @('run', '--rm', '--no-deps', 'node', 'npm', 'run', 'build')
            Invoke-Compose -CommandArguments @(
                'run', '--rm', '--no-deps', 'java',
                'mvn', '--batch-mode', '--no-transfer-progress', '-f', 'services/api/pom.xml', '-DskipTests', 'package'
            )
        }
        'Test' {
            Test-Frontend
            Test-Backend
        }
        'Up' {
            Install-Dependencies
            Invoke-Compose -CommandArguments @('run', '--rm', '--no-deps', 'node', 'npm', 'run', 'build')
            Invoke-Compose -CommandArguments @(
                'run', '--rm', '--no-deps', 'java',
                'mvn', '--batch-mode', '--no-transfer-progress', '-f', 'services/api/pom.xml', '-DskipTests', 'package'
            )
            Start-Runtime
        }
        'Smoke' {
            Test-Smoke
            & (Join-Path $PSScriptRoot 'verify-runtime.ps1')
        }
        'Verify' {
            Install-Dependencies
            Test-Frontend
            Test-Backend
            Start-Runtime
            Test-Smoke
            & (Join-Path $PSScriptRoot 'verify-runtime.ps1')
        }
        'Status' {
            Invoke-Compose -CommandArguments @('ps', '--all')
        }
    }
    Write-Host "`nHalluminate action '$Action' completed successfully."
}
finally {
    Pop-Location
}
