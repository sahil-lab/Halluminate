export interface Probe {
  id: string;
  fixture: "phase-1-synthetic";
  createdAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function request(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(path, {
    ...init,
    signal: AbortSignal.timeout(6000),
    headers: {
      Accept: "application/json",
      ...init?.headers,
    },
  });
  const body: unknown = await response.json();
  if (!response.ok) {
    const detail =
      isRecord(body) && typeof body.detail === "string"
        ? body.detail
        : `The local API returned HTTP ${response.status}.`;
    const requestId =
      isRecord(body) && typeof body.requestId === "string"
        ? ` Request ID: ${body.requestId}`
        : "";
    throw new Error(`${detail}${requestId}`);
  }
  return body;
}

function parseProbe(body: unknown): Probe {
  if (
    !isRecord(body) ||
    typeof body.id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.id) ||
    body.fixture !== "phase-1-synthetic" ||
    typeof body.createdAt !== "string" ||
    !Number.isFinite(Date.parse(body.createdAt))
  ) {
    throw new Error(
      "The API returned an invalid probe response. No success is recorded.",
    );
  }
  return {
    id: body.id,
    fixture: body.fixture,
    createdAt: body.createdAt,
  };
}

export async function checkReadiness(): Promise<void> {
  const body = await request("/actuator/health/readiness");
  if (!isRecord(body) || body.status !== "UP") {
    throw new Error("The API and database are not ready.");
  }
}

export async function checkPersistence(): Promise<Probe> {
  const written = parseProbe(
    await request("/api/bootstrap/probes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fixture: "phase-1-synthetic" }),
    }),
  );
  const read = parseProbe(await request(`/api/bootstrap/probes/${written.id}`));
  if (
    read.id !== written.id ||
    read.fixture !== written.fixture ||
    read.createdAt !== written.createdAt
  ) {
    throw new Error(
      "Database readback did not match the write. No success is recorded.",
    );
  }
  return read;
}
