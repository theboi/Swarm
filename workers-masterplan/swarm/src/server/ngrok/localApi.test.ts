import { describe, expect, it } from "vitest";

import { findNgrokPublicUrl, waitForNgrokPublicUrl } from "./localApi.js";

describe("local ngrok inspector", () => {
  it("selects only an http(s) public URL for the coordinator target", () => {
    expect(findNgrokPublicUrl({ tunnels: [
      { public_url: "tcp://0.tcp.ngrok.io:1234", config: { addr: "http://127.0.0.1:4310" } },
      { public_url: "https://edenmind.example.ngrok.app/?token=secret", config: { addr: "http://127.0.0.1:4310" } },
    ] }, "http://127.0.0.1:4310")).toBe("https://edenmind.example.ngrok.app/?token=secret");
    expect(findNgrokPublicUrl({ tunnels: [{ public_url: "https://other.example.ngrok.app", config: { addr: "http://127.0.0.1:9999" } }] }, "http://127.0.0.1:4310")).toBeNull();
  });

  it("retries the loopback inspector until the tunnel is ready", async () => {
    let calls = 0;
    const result = await waitForNgrokPublicUrl({
      target: "http://127.0.0.1:4310",
      attempts: 3,
      fetchJson: async () => {
        calls += 1;
        return calls === 3 ? { tunnels: [{ public_url: "https://edenmind.example.ngrok.app", config: { addr: "http://127.0.0.1:4310" } }] } : { tunnels: [] };
      },
      sleep: async () => undefined,
    });
    expect(result).toBe("https://edenmind.example.ngrok.app");
    expect(calls).toBe(3);
  });

  it("fails closed when no local tunnel becomes available", async () => {
    await expect(waitForNgrokPublicUrl({ target: "http://127.0.0.1:4310", attempts: 1, fetchJson: async () => ({ tunnels: [] }), sleep: async () => undefined })).rejects.toThrow("public URL");
  });
});
