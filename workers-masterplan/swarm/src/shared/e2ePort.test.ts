import { createServer } from "node:net";
import { afterEach, describe, expect, it } from "vitest";

import { allocateLoopbackPort } from "./e2ePort";

const openServers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(openServers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

describe("allocateLoopbackPort", () => {
  it("asks the OS for an available loopback port", async () => {
    const port = await allocateLoopbackPort();
    expect(port).toBeGreaterThan(0);
  });

  it("does not reuse an occupied preferred port", async () => {
    const occupied = createServer();
    openServers.push(occupied);
    await new Promise<void>((resolve) => occupied.listen(0, "127.0.0.1", resolve));
    const address = occupied.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP address");

    expect(await allocateLoopbackPort(address.port)).not.toBe(address.port);
  });
});
