import type { NextConfig } from "next";

// Single-container deployments (the Hugging Face Space) serve the API on the same origin: the browser calls
// /api/..., and Next proxies it to the FastAPI process inside the container. Set at build time:
//   API_PROXY_TARGET=http://127.0.0.1:8000  NEXT_PUBLIC_API_URL=""
// Unset (local development), nothing changes: the browser calls http://localhost:8000 directly.
const apiProxyTarget = process.env.API_PROXY_TARGET;

const nextConfig: NextConfig = {
  // Hide the dev "N" badge so it never appears in the demo recording.
  devIndicators: false,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  ...(apiProxyTarget
    ? {
        async rewrites() {
          return [{ source: "/api/:path*", destination: `${apiProxyTarget}/api/:path*` }];
        },
      }
    : {}),
};

export default nextConfig;
