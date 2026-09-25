import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The corpus index is read at runtime by the API routes; ship it with them.
  outputFileTracingIncludes: {
    "/api/story": ["./data/corpus.db"],
    "/api/verify": ["./data/corpus.db"],
    // Saved narrations are read from disk when a story page renders.
    "/story/[id]": ["./data/narrations/**/*"],
  },
};

export default nextConfig;
