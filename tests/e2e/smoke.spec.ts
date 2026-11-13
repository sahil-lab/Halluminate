import { randomUUID } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";

const api = process.env["E2E_API_URL"] ?? "http://127.0.0.1:18204";
const unavailableApi = process.env["E2E_UNAVAILABLE_API_URL"];

/** Resolves once two animation frames have passed, so pending draws are on screen. */
async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

/**
 * The particle backdrop alone: page content is hidden while the picture is taken, and
 * the fixed header and motion control are cropped out.
 */
async function fieldPixels(page: Page): Promise<Buffer> {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("A fixed viewport is required to sample the field.");
  const content = page.locator("main");
  await content.evaluate((element) => {
    element.style.visibility = "hidden";
  });
  const image = await page.screenshot({
    clip: { x: 0, y: 96, width: viewport.width, height: viewport.height - 168 },
  });
  await content.evaluate((element) => {
    element.style.visibility = "";
  });
  return image;
}

async function scrollStory(page: Page, progress: number): Promise<void> {
  await page.evaluate((at) => {
    const story = document.querySelector<HTMLElement>("[data-story]");
    if (!story) throw new Error("The scroll story is missing.");
    const top = story.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, top + (story.offsetHeight - window.innerHeight) * at);
  }, progress);
}

/** Collects page errors, console errors and requests that leave the page's origin. */
function watchPage(page: Page, baseURL: string | undefined): string[] {
  if (!baseURL) throw new Error("A base URL is required to watch the page.");
  const origin = new URL(baseURL).origin;
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(`page error: ${error.message}`));
  page.on("console", (message) => {
    // The in-network test origin (http://web:8080) is not a secure context, so Chromium
    // reports that it ignores the COOP header there. On localhost the header applies.
    if (
      message.type() === "error" &&
      !message.text().includes("Cross-Origin-Opener-Policy header has been ignored")
    ) {
      problems.push(`console error: ${message.text()}`);
    }
  });
  page.on("request", (sent) => {
    const url = sent.url();
    // data: URLs are inline resources and never leave the page.
    if (!url.startsWith("data:") && new URL(url).origin !== origin) {
      problems.push(`external request: ${url}`);
    }
  });
  return problems;
}

test("real browser writes, reads, repeats and renders the synthetic probe", async ({
  page,
  request,
  baseURL,
}) => {
  const problems = watchPage(page, baseURL);
  // Reduced motion draws each formation once, so the full-quality level is affordable
  // here and the saved pictures show what a hardware renderer displays.
  await page.emulateMedia({ reducedMotion: "reduce" });
  const navigation = await page.goto("/?quality=high");
  expect(navigation?.status()).toBe(200);
  expect(navigation?.headers()["content-security-policy"]).toContain(
    "connect-src 'self'",
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Make the unknown repeatable.",
  );
  await expect(page.getByText("API and database ready")).toBeVisible();

  const root = page.locator("html");
  const field = page.locator("canvas.field");
  await expect(field).toHaveAttribute("data-renderer", "webgl2");
  await expect(field).toHaveAttribute("data-lit", "true");
  await page.evaluate(() => document.fonts.ready);

  await page.getByRole("link", { name: "Open live sandbox" }).click();
  await expect(
    page.getByRole("heading", { name: "Small test. Real proof." }),
  ).toBeInViewport();
  await expect(root).toHaveAttribute("data-header", "hidden");
  await page.getByRole("button", { name: "Run synthetic check" }).click();
  await expect(page.getByText("Persistence verified")).toBeVisible();
  const id = await page.getByTestId("probe-id").textContent();
  expect(id).toMatch(/^[0-9a-f-]{36}$/);
  const steps = page.getByRole("list", { name: "Round trip" }).getByRole("listitem");
  await expect(steps).toHaveText([/Confirmed/, /Confirmed/, /Confirmed/]);

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

  await settle(page);
  await page.screenshot({ path: ".local/evidence/halluminate-cinematic-sandbox.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "Run synthetic check" })).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  // Scrolling back up returns the header that stepped aside on the way down.
  await page.mouse.move(195, 420);
  await page.mouse.wheel(0, -320);
  await expect(root).not.toHaveAttribute("data-header", "hidden");
  await page.getByRole("link", { name: "Halluminate home" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeInViewport();
  await settle(page);
  await page.screenshot({ path: ".local/evidence/halluminate-cinematic-mobile.png" });
  expect(problems).toEqual([]);
});

test("the opening sequence ends, the cursor names its target and motion can be paused", async ({
  page,
  baseURL,
}) => {
  const problems = watchPage(page, baseURL);
  await page.goto("/");
  const root = page.locator("html");
  await expect(root).toHaveAttribute("data-motion", "on");
  // The opening overlay must always leave, or it would cover the page for good.
  await expect(root).toHaveAttribute("data-intro", "done");
  await expect(page.locator(".intro")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toBeInViewport();
  // This container has no GPU, so WebGL is emulated: the field must show a still
  // formation instead of animating at the expense of the rest of the page.
  const field = page.locator("canvas.field");
  await expect(field).toHaveAttribute("data-lit", "true");
  await expect(field).toHaveAttribute("data-mode", "still");

  const cursor = page.locator(".cursor");
  await page.getByRole("link", { name: "Open live sandbox" }).hover();
  await expect(cursor).toHaveAttribute("data-state", "active");
  await expect(cursor.locator(".cursor-label")).toHaveText("Open");
  await page.mouse.move(640, 200);
  await expect(cursor).toHaveAttribute("data-state", "idle");

  await page.getByRole("button", { name: "Pause animation" }).click();
  await expect(root).toHaveAttribute("data-motion", "off");
  await expect(page.getByRole("button", { name: "Play animation" })).toBeVisible();
  expect(problems).toEqual([]);
});

test("scrolling the pinned story swaps chapters and reshapes the particle field", async ({
  page,
}) => {
  // With reduced motion each formation is drawn once, so this bounded software
  // renderer can afford the full-quality level that hardware normally runs.
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?quality=high");
  const field = page.locator("canvas.field");
  await expect(field).toHaveAttribute("data-lit", "true");
  await expect(field).toHaveAttribute("data-particles", "56000");
  await page.evaluate(() => document.fonts.ready);
  await settle(page);
  const frames = [await fieldPixels(page)];
  await page.screenshot({ path: ".local/evidence/halluminate-cinematic-hero.png" });

  const active = page.locator('[data-chapter][data-state="active"]');
  for (const [progress, heading, index] of [
    [0.12, "Isolate the world.", "01"],
    [0.5, "Follow the thought.", "02"],
    [0.9, "Return to the why.", "03"],
  ] as const) {
    await scrollStory(page, progress);
    await expect(active).toHaveCount(1);
    await expect(active.getByRole("heading")).toHaveText(heading);
    await expect(active.getByRole("heading")).toBeInViewport();
    await expect(page.locator("[data-story-index]")).toHaveText(index);
    await settle(page);
    frames.push(await fieldPixels(page));
    await page.screenshot({
      path: `.local/evidence/halluminate-cinematic-chapter-${index}.png`,
    });
  }

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(
    page.getByText("Independent prototype. Not affiliated with Halluminate."),
  ).toBeInViewport();
  await settle(page);
  frames.push(await fieldPixels(page));
  await page.screenshot({ path: ".local/evidence/halluminate-cinematic-footer.png" });

  // Orb, contained world, trace, loop and horizon are five different pictures.
  const distinct = new Set(frames.map((frame) => frame.toString("base64")));
  expect(distinct.size).toBe(frames.length);
});

test("reduced motion keeps the field still and animation is explicitly controllable", async ({
  page,
}) => {
  // Software rendering is slow in this bounded browser, so this check uses a small
  // viewport and pins the lightest level. Pinning also turns the automatic adjustment
  // off, which would otherwise hold a field this slow still.
  await page.setViewportSize({ width: 640, height: 480 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?quality=minimal");
  const root = page.locator("html");
  await expect(root).toHaveAttribute("data-motion", "off");
  await expect(root).toHaveAttribute("data-intro", "done");
  await expect(page.locator("canvas.field")).toHaveAttribute("data-lit", "true");
  await page.evaluate(() => document.fonts.ready);
  await settle(page);
  const first = await fieldPixels(page);
  await page.waitForTimeout(300);
  expect((await fieldPixels(page)).equals(first)).toBe(true);
  expect(
    await page.evaluate(
      () =>
        document
          .getAnimations()
          .filter((animation) => animation.playState === "running").length,
    ),
  ).toBe(0);

  await page.getByRole("button", { name: "Play animation" }).click();
  await expect(root).toHaveAttribute("data-motion", "on");
  await settle(page);
  expect((await fieldPixels(page)).equals(first)).toBe(false);
  await page.getByRole("button", { name: "Pause animation" }).click();
  await expect(root).toHaveAttribute("data-motion", "off");
  await settle(page);
  const paused = await fieldPixels(page);
  await page.waitForTimeout(300);
  expect((await fieldPixels(page)).equals(paused)).toBe(true);
});

test("without WebGL2 the page says so, keeps a static backdrop and the sandbox works", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      writable: true,
      value: function (this: HTMLCanvasElement, kind: string, options?: unknown) {
        return kind === "webgl2" ? null : original.call(this, kind, options);
      },
    });
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-renderer", "none");
  await expect(page.locator(".backdrop-fallback")).toBeVisible();
  await expect(
    page.getByText("Static backdrop. The live field could not start in this browser."),
  ).toBeVisible();
  await expect(page.getByText("Generative artwork. Not evaluation data.")).toBeHidden();
  await page.getByRole("button", { name: "Run synthetic check" }).click();
  await expect(page.getByText("Persistence verified")).toBeVisible();
});

test("keyboard navigation reaches the real sandbox and the narrow layout does not overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to live sandbox" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#workspace")).toBeFocused();
  await expect(
    page.getByRole("heading", { name: "Small test. Real proof." }),
  ).toBeInViewport();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Run synthetic check" }).click();
  await expect(page.getByText("Persistence verified")).toBeVisible();
  const clippedControls = await page
    .locator("button, .main-nav a, .hero-actions a")
    .evaluateAll((elements) =>
      elements
        .filter((element) => {
          const bounds = element.getBoundingClientRect();
          return (
            bounds.width > 0 &&
            (bounds.left < 0 || bounds.right > document.documentElement.clientWidth + 1)
          );
        })
        .map((element) => element.textContent),
    );
  expect(clippedControls).toEqual([]);
  const clippedType = await page
    .locator(
      ".hero-title .line, .chapter h3 .line, .sandbox h2 .line, .footer-wordmark",
    )
    .evaluateAll((elements) =>
      elements
        .filter((element) => element.scrollWidth > element.clientWidth + 1)
        .map((element) => element.textContent),
    );
  expect(clippedType).toEqual([]);
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
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByText("API and database ready")).toBeVisible();
  await page.route("**/api/bootstrap/probes", (route) => route.abort("failed"));
  await page.getByRole("button", { name: "Run synthetic check" }).click();
  await expect(page.getByRole("alert")).toContainText("Check failed");
  await expect(page.getByText("Persistence verified")).toHaveCount(0);
  await expect(
    page.getByRole("list", { name: "Round trip" }).getByRole("listitem").first(),
  ).toContainText("Stopped here");

  await page.unroute("**/api/bootstrap/probes");
  await page.getByRole("button", { name: "Run synthetic check" }).click();
  await expect(page.getByText("Persistence verified")).toBeVisible();
});
