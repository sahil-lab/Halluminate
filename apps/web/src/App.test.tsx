import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { checkPersistence, type Probe } from "./api";

vi.mock("./SignalField", () => ({
  SignalField: () => <figure aria-label="Decorative generative artwork" />,
}));

const probe: Probe = {
  id: "24f678e8-e901-4992-b12a-ac290ea9f2f3",
  fixture: "phase-1-synthetic",
  createdAt: "2026-01-01T00:00:00Z",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("local skeleton", () => {
  it("shows success only after matching database readback", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ status: "UP" }))
      .mockResolvedValueOnce(json(probe))
      .mockResolvedValueOnce(json(probe))
      .mockResolvedValueOnce(json({ status: "UP" }));
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    await screen.findByText("API and database ready");
    fireEvent.click(screen.getByRole("button", { name: "Run synthetic check" }));
    expect(await screen.findByText("Persistence verified")).toBeInTheDocument();
    expect(screen.getByTestId("probe-id")).toHaveTextContent(probe.id);
    expect(fetchMock.mock.calls[2]?.[0]).toBe(`/api/bootstrap/probes/${probe.id}`);
  });

  it("shows an actionable error and allows retry after a failed write", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ status: "UP" }))
      .mockResolvedValueOnce(
        json({ detail: "Database is unavailable.", requestId: "test-request-id" }, 503),
      )
      .mockResolvedValueOnce(json({ status: "UP" }))
      .mockResolvedValueOnce(json(probe))
      .mockResolvedValueOnce(json(probe))
      .mockResolvedValueOnce(json({ status: "UP" }));
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    await screen.findByText("API and database ready");
    fireEvent.click(screen.getByRole("button", { name: "Run synthetic check" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("test-request-id");
    expect(screen.queryByText("Persistence verified")).not.toBeInTheDocument();
    await screen.findByText("API and database ready");
    fireEvent.click(screen.getByRole("button", { name: "Run synthetic check" }));
    expect(await screen.findByText("Persistence verified")).toBeInTheDocument();
  });

  it("does not claim readiness when the network is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    render(<App />);
    expect(await screen.findByText("Local services unavailable")).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to fetch");
    expect(screen.queryByText("API and database ready")).not.toBeInTheDocument();
  });

  it("rejects a successful HTTP response with an invalid probe shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(json({ ...probe, id: "invalid" })),
    );
    await expect(checkPersistence()).rejects.toThrow("invalid probe response");
  });

  it("rejects a mismatch between the write and read responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(json(probe))
        .mockResolvedValueOnce(json({ ...probe, createdAt: "2026-02-01T00:00:00Z" })),
    );
    await expect(checkPersistence()).rejects.toThrow("readback did not match");
  });

  it("keeps the live console busy until the readback completes", async () => {
    let completeReadback: (response: Response) => void = () => {
      throw new Error("The readback request has not started.");
    };
    const pending = new Promise<Response>((resolve) => {
      completeReadback = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(json({ status: "UP" }))
        .mockResolvedValueOnce(json(probe))
        .mockReturnValueOnce(pending)
        .mockResolvedValueOnce(json({ status: "UP" })),
    );
    render(<App />);
    await screen.findByText("API and database ready");
    fireEvent.click(screen.getByRole("button", { name: "Run synthetic check" }));
    expect(await screen.findByRole("button", { name: "Verifying..." })).toBeDisabled();
    expect(
      screen.getByRole("region", { name: "A little evidence goes a long way." }),
    ).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("Persistence verified")).not.toBeInTheDocument();
    completeReadback(json(probe));
    expect(await screen.findByText("Persistence verified")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run synthetic check" })).toBeEnabled();
  });
});
