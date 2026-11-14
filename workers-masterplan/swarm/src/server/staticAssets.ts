import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";

/** Locates the compiled client independently of the coordinator's working directory. */
export function staticAssetDirectory(serverModuleUrl: string): string {
  return resolve(fileURLToPath(new URL("../../client/out", serverModuleUrl)));
}

/** Next exports route-fragment directories beside HTML; serve HTML before static directory redirects. */
export function createDashboardRouter(directory: string): express.Router {
  const router = express.Router();
  const root = resolve(directory);
  router.get(["/", "/home", "/accounts", "/queued-tasks", "/chats"], (request, response) => {
    const page = request.path.replace(/^\/+|\/+$/g, "");
    response.sendFile(page ? `${page}.html` : "index.html", { root });
  });
  router.use(express.static(root, { index: "index.html", fallthrough: true }));
  router.use((_request, response) => response.sendFile("index.html", { root }));
  return router;
}
