import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import type { NextConfig } from "next";

// the model version comes from victors export, so a model update needs no vercel env change.
// NEXT_PUBLIC_MODEL_VERSION is only the fallback when ml/ isnt in the build
function modelVersion(): string | undefined {
  try {
    return JSON.parse(readFileSync("../ml/export/example_response.json", "utf8")).model_version;
  } catch {
    return process.env.NEXT_PUBLIC_MODEL_VERSION;
  }
}

// vercel sets the sha, a local build asks git
function commit(): string {
  try {
    return process.env.VERCEL_GIT_COMMIT_SHA || execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_MODEL_VERSION: modelVersion() ?? "stub-0.1", NEXT_PUBLIC_COMMIT: commit() },
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
};

export default nextConfig;
