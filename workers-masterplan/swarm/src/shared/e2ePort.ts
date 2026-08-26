import { createServer } from "node:net";

export async function allocateLoopbackPort(preferred?: number): Promise<number> {
  const candidates = preferred === undefined ? [0] : [preferred, 0];

  for (const port of candidates) {
    const selected = await new Promise<number | null>((resolve, reject) => {
      const server = createServer();
      server.unref();
      server.once("error", (error: NodeJS.ErrnoException) => {
        if (error.code === "EADDRINUSE") resolve(null);
        else reject(error);
      });
      server.listen({ host: "127.0.0.1", port, exclusive: true }, () => {
        const address = server.address();
        const selectedPort = typeof address === "object" && address ? address.port : null;
        server.close((error) => (error ? reject(error) : resolve(selectedPort)));
      });
    });
    if (selected !== null) return selected;
  }

  throw new Error("Unable to allocate a loopback port");
}
