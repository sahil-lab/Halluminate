[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ComposeFile = Join-Path $ProjectRoot 'infra\docker\compose.yaml'
$EvidenceDir = Join-Path $ProjectRoot '.local\evidence'
$budgets = @{
    db = @{ Memory = 256MB; CPUs = 0.5; Pids = 128; Port = $null }
    api = @{ Memory = 512MB; CPUs = 0.75; Pids = 128; Port = '18204' }
    web = @{ Memory = 96MB; CPUs = 0.25; Pids = 64; Port = '18104' }
}
$ids = @(& docker compose -p halluminate -f $ComposeFile ps --quiet db api web)
if ($LASTEXITCODE -ne 0 -or $ids.Count -ne 3) {
    throw 'Expected exactly three running Halluminate runtime containers.'
}
$raw = & docker inspect @ids
if ($LASTEXITCODE -ne 0) {
    throw 'Could not inspect Halluminate runtime containers.'
}
$containers = $raw | ConvertFrom-Json
$results = foreach ($container in $containers) {
    $service = $container.Config.Labels.'com.docker.compose.service'
    $budget = $budgets[$service]
    if (-not $budget -or $container.Config.Labels.'com.docker.compose.project' -ne 'halluminate') {
        throw 'Unexpected project or service in runtime inspection.'
    }
    if ($container.State.Health.Status -ne 'healthy') {
        throw "$service is not healthy."
    }
    if ($container.HostConfig.Memory -ne $budget.Memory -or
        $container.HostConfig.NanoCpus -ne ($budget.CPUs * 1000000000) -or
        $container.HostConfig.PidsLimit -ne $budget.Pids) {
        throw "$service does not match its approved resource limits."
    }
    if (-not $container.HostConfig.ReadonlyRootfs -or $container.HostConfig.Privileged) {
        throw "$service has an unsafe runtime filesystem or privilege setting."
    }
    $bindings = @($container.HostConfig.PortBindings.PSObject.Properties | Where-Object { $_.Value })
    $effectiveBindings = @($container.NetworkSettings.Ports.PSObject.Properties | Where-Object { $_.Value })
    if ($null -eq $budget.Port) {
        if ($bindings.Count -ne 0 -or $effectiveBindings.Count -ne 0) {
            throw 'PostgreSQL must have no published port.'
        }
    }
    else {
        if ($bindings.Count -ne 1 -or $bindings[0].Value.Count -ne 1 -or
            $bindings[0].Value[0].HostIp -ne '127.0.0.1' -or
            $bindings[0].Value[0].HostPort -ne $budget.Port) {
            throw "$service is not bound exclusively to its assigned loopback port."
        }
        if ($effectiveBindings.Count -ne 1 -or $effectiveBindings[0].Value.Count -ne 1 -or
            $effectiveBindings[0].Value[0].HostIp -ne '127.0.0.1' -or
            $effectiveBindings[0].Value[0].HostPort -ne $budget.Port) {
            throw "$service requests a port but Docker has not actually published the approved loopback binding."
        }
    }
    $networks = @($container.NetworkSettings.Networks.PSObject.Properties.Name)
    $expectedNetworks = @('halluminate_runtime')
    if ($service -ne 'db') {
        $expectedNetworks += 'halluminate_tooling'
    }
    if ((($networks | Sort-Object) -join ',') -ne (($expectedNetworks | Sort-Object) -join ',')) {
        throw "$service has unexpected network attachments."
    }
    [ordered]@{
        service = $service
        status = $container.State.Health.Status
        image = $container.Config.Image
        imageId = $container.Image
        memoryBytes = $container.HostConfig.Memory
        cpuLimit = $budget.CPUs
        pidLimit = $container.HostConfig.PidsLimit
        readOnlyRoot = $container.HostConfig.ReadonlyRootfs
        hostPort = $budget.Port
        networks = $networks
        effectivePortVerified = $true
    }
}
$internal = & docker network inspect halluminate_runtime --format '{{.Internal}}'
if ($LASTEXITCODE -ne 0 -or $internal -ne 'true') {
    throw 'Halluminate runtime network must be internal.'
}
$results | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $EvidenceDir 'runtime-inspection.json')

$databaseSql = "SELECT json_build_object('migrationVersion', (SELECT version FROM flyway_schema_history WHERE success ORDER BY installed_rank DESC LIMIT 1), 'successfulMigrations', (SELECT count(*) FROM flyway_schema_history WHERE success), 'probeRows', (SELECT count(*) FROM bootstrap_probes));"
$databaseJson = & docker compose -p halluminate -f $ComposeFile exec -T db psql -U halluminate -d halluminate -t -A -v ON_ERROR_STOP=1 -c $databaseSql
if ($LASTEXITCODE -ne 0) {
    throw 'Could not verify actual migration history and probe row count.'
}
$database = $databaseJson | ConvertFrom-Json
if ($database.migrationVersion -ne '1' -or $database.successfulMigrations -ne 1 -or $database.probeRows -ne 1) {
    throw 'Expected exactly Flyway V1 and one bounded synthetic row.'
}
$database | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $EvidenceDir 'database-state.json')

$before = Invoke-RestMethod -Uri 'http://127.0.0.1:18204/api/bootstrap/probes' -Method Post -ContentType 'application/json' -Body '{"fixture":"phase-1-synthetic"}' -TimeoutSec 10
& docker compose -p halluminate -f $ComposeFile up --detach --no-deps --force-recreate --wait --wait-timeout 180 api
if ($LASTEXITCODE -ne 0) {
    throw 'The Halluminate API failed to become healthy after recreation.'
}
$after = Invoke-RestMethod -Uri ("http://127.0.0.1:18204/api/bootstrap/probes/" + $before.id) -TimeoutSec 10
if ($before.id -ne $after.id -or $before.fixture -ne $after.fixture -or $before.createdAt -ne $after.createdAt) {
    throw 'Persistence was not preserved across API recreation.'
}
$proxied = Invoke-RestMethod -Uri 'http://127.0.0.1:18104/actuator/health/readiness' -TimeoutSec 10
if ($proxied.status -ne 'UP') {
    throw 'The web proxy is not ready after API recreation.'
}
[ordered]@{
    verifiedAtUtc = [DateTime]::UtcNow.ToString('o')
    apiRecreated = $true
    recordPreserved = $true
    proxyReady = $true
    probe = $after
} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $EvidenceDir 'persistence-restart.json')

Write-Host 'Verified: effective loopback publishing, internal DB network, resource limits, Flyway V1, singleton data, API recreation and proxy readiness.'
