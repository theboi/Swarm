import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = dirname(fileURLToPath(import.meta.url));

export default {
  output: "export",
  reactStrictMode: true,
  images: { unoptimized: true },
  webpack(config) {
    config.resolve.modules = [resolve(root, "../node_modules"), ...(config.resolve.modules ?? ["node_modules"])];
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": resolve(root, "src"),
      // Linked Eden sources must use the application's React and Radix instances.
      "react$": require.resolve("react"),
      "react-dom$": require.resolve("react-dom"),
      "@radix-ui/themes$": require.resolve("@radix-ui/themes"),
      "radix-ui$": require.resolve("radix-ui"),
    };
    config.resolve.extensionAlias = { ...config.resolve.extensionAlias, ".js": [".ts", ".tsx", ".js"] };
    return config;
  },
};
