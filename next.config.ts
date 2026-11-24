import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  devIndicators: false,
  cacheComponents: true,
  partialPrefetching: true,
  transpilePackages: ["lucide-react"],
  experimental: {
    turbopackPluginRuntimeStrategy: "forceWorkerThreads",
    agentUpgrade: "security",
  },
  turbopack: {
    root: import.meta.dirname,
    rules: {
      "*.css": {
        loaders: ["./src/lib/legacy-css-loader.mjs"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
