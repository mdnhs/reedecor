import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["draco3d"],
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
