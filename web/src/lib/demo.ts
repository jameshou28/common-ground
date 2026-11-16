// the recorded tour (components/demo) runs locally only: in dev, or a production build with NEXT_PUBLIC_DEMO=1
export const DEMO_ON = process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_DEMO === "1";
export const DEMO_START = "cg-demo-start";
