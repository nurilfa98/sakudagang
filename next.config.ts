import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Batas ukuran body Server Action (bawaan 1 MB), dinaikkan untuk unggah file.
    // Batas per file sebaiknya diatur lagi di zod schema fitur yang mengunggah.
    // Referensi: node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverActions.md
    serverActions: { bodySizeLimit: "5mb" },
  },
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
