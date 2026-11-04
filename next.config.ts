import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // mammoth and happy-dom are Node-only; keep them out of the server bundle.
  serverExternalPackages: ["mammoth", "happy-dom"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
