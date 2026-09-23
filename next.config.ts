import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The corpus index is read at runtime by the API routes; ship it with them.
  outputFileTracingIncludes: {
    "/api/story": ["./data/corpus.db"],
    "/api/verify": ["./data/corpus.db"],
  },
};

export default nextConfig;
