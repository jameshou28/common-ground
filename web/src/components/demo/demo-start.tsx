"use client";

import { useState } from "react";
import { DEMO_START } from "@/lib/demo";

// a black screen with one red button. pressing it goes full screen, holds black for 8 seconds (time to settle the
// recording) and then hands over to the director, which opens the globe
export function DemoStart() {
  const [armed, setArmed] = useState(false);
  const go = async () => {
    setArmed(true);
    try {
      await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    } catch {}
    window.dispatchEvent(new Event(DEMO_START));
  };
  return (
    <div className="fixed inset-0 z-[150] grid place-items-center bg-black">
      {!armed && (
        <button
          type="button"
          onClick={go}
          className="rounded-full bg-red-600 px-12 py-5 text-2xl font-semibold tracking-wider text-white uppercase shadow-[0_0_60px_rgb(220_38_38_/_0.45)] hover:bg-red-500"
        >
          Start
        </button>
      )}
    </div>
  );
}
