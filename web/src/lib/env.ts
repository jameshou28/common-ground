// public config, everything here ships to the browser
export const env = {
  apiUrl: (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, ""),
  gridBase: (process.env.NEXT_PUBLIC_GRID_BASE ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, ""),
  cesiumToken: process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN ?? "",
  supabaseUrl: (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, ""),
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  modelVersion: process.env.NEXT_PUBLIC_MODEL_VERSION ?? "stub-0.1",
  liveScoring: process.env.NEXT_PUBLIC_LIVE_SCORING !== "false",
} as const;
