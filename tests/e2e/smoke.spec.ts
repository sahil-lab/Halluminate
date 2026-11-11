import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

const api = process.env["E2E_API_URL"] ?? "http://127.0.0.1:18204";
const unavailableApi = process.env["E2E_UNAVAILABLE_API_URL"];

test("real browser writes, reads, repeats and renders the synthetic probe", async ({
  page,
  request,
  baseURL,
}) => {
  const pageErrors: string[] = [];
  const externalRequests: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (sent) => {
    if (new URL(sent.url()).origin !== new URL(baseURL!).origin) {
      externalRequests.push(sent.url());
    }
  });

  const navigation = await page.goto("/");
  expect(navigation?.status()).toBe(200);
  expect(navigation?.headers()["content-security-policy"]).toContain(
    "connect-src 'self'",
  );
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("API and database ready")).toBeVisible();
  await page.getByRole("button", { name: "Run synthetic check" }).click();
  await expect(page.getByText("Persistence verified")).toBeVisible();
  const id = await page.getByTestId("probe-id").textContent();
  expect(id).toMatch(/^[0-9a-f-]{36}$/);

  const read = await request.get(`${api}/api/bootstrap/probes/${id}`);
  expect(read.status()).toBe(200);
  const first: unknown = await read.json();
  expect(first).toEqual({
    id,
    fixture: "phase-1-synthetic",
    createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.*Z$/),
  });
  const repeated = await request.post(`${api}/api/bootstrap/probes`, {
    data: { fixture: "phase-1-synthetic" },
  });
  expect(repeated.status()).toBe(200);
  expect(await repeated.json()).toEqual(first);

  await page.screenshot({
    path: ".local/evidence/halluminate-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "Run synthetic check" })).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".local/evidence/halluminate-mobile.png",
    fullPage: true,
  });
  expect(pageErrors).toEqual([]);
  expect(externalRequests).toEqual([]);
});

test("live API rejects invalid input with correlated, non-sensitive Problem Details", async ({
  request,
}) => {
  for (const data of [
    {},
    { fixture: "" },
    { fixture: "not-approved" },
    { fixture: "phase-1-synthetic", unexpected: "field" },
    { fixture: 1 },
  ]) {
    const response = await request.post(`${api}/api/bootstrap/probes`, { data });
    expect(response.status()).toBe(400);
    expect(response.headers()["content-type"]).toContain("application/problem+json");
    expect(response.headers()["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
    const problem: unknown = await response.json();
    expect(problem).toMatchObject({
      type: "about:blank",
      title: "Bad Request",
      status: 400,
      requestId: response.headers()["x-request-id"],
    });
    expect(JSON.stringify(problem)).not.toMatch(
      /password|jdbc:|stackTrace|SQLException/,
    );
  }
  const malformed = await request.post(`${api}/api/bootstrap/probes`, {
    headers: { "Content-Type": "application/json" },
    data: '{"fixture":',
  });
  expect(malformed.status()).toBe(400);
});

test("health, unknown identifiers, content type and Origin boundaries are real", async ({
  request,
}) => {
  for (const group of ["liveness", "readiness"]) {
    const response = await request.get(`${api}/actuator/health/${group}`);
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ status: "UP" });
  }
  const absent = await request.get(`${api}/api/bootstrap/probes/${randomUUID()}`);
  expect(absent.status()).toBe(404);
  const invalidId = await request.get(`${api}/api/bootstrap/probes/not-a-uuid`);
  expect(invalidId.status()).toBe(400);
  const wrongType = await request.post(`${api}/api/bootstrap/probes`, {
    headers: { "Content-Type": "text/plain" },
    data: "phase-1-synthetic",
  });
  expect(wrongType.status()).toBe(415);
  for (const origin of ["https://untrusted.invalid", "null"]) {
    const blocked = await request.post(`${api}/api/bootstrap/probes`, {
      headers: { Origin: origin },
      data: { fixture: "phase-1-synthetic" },
    });
    expect(blocked.status()).toBe(403);
    expect(await blocked.json()).toMatchObject({ status: 403 });
  }
  const allowed = await request.post(`${api}/api/bootstrap/probes`, {
    headers: { Origin: "http://localhost:18104" },
    data: { fixture: "phase-1-synthetic" },
  });
  expect(allowed.status()).toBe(200);
});

test("real API with an unreachable database is live but not ready and cannot write", async ({
  request,
}) => {
  if (!unavailableApi) {
    throw new Error(
      "E2E_UNAVAILABLE_API_URL is required for the real DB failure smoke.",
    );
  }
  const live = await request.get(`${unavailableApi}/actuator/health/liveness`);
  expect(live.status()).toBe(200);
  expect(await live.json()).toEqual({ status: "UP" });
  const readiness = await request.get(`${unavailableApi}/actuator/health/readiness`);
  expect(readiness.status()).toBe(503);
  expect(await readiness.json()).toEqual({ status: "DOWN" });
  const write = await request.post(`${unavailableApi}/api/bootstrap/probes`, {
    data: { fixture: "phase-1-synthetic" },
  });
  expect(write.status()).toBe(503);
  expect(await write.json()).toMatchObject({
    status: 503,
    detail: "Database is unavailable. Retry the local check.",
    requestId: write.headers()["x-request-id"],
  });
});

test("browser surfaces a failed request and recovers without stale success", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("API and database ready")).toBeVisible();
  await page.route("**/api/bootstrap/probes", (route) => route.abort("failed"));
  await page.getByRole("button", { name: "Run synthetic check" }).click();
  await expect(page.getByRole("alert")).toContainText("Check failed");
  await expect(page.getByText("Persistence verified")).toHaveCount(0);

  await page.unroute("**/api/bootstrap/probes");
  await page.getByRole("button", { name: "Run synthetic check" }).click();
  await expect(page.getByText("Persistence verified")).toBeVisible();
});
