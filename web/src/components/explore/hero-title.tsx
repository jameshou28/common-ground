"use client";

import { useEffect, useState } from "react";

// "Common Ground" in silver, behind the earth on the front page. it goes for the rest of the session the moment
// anything is clicked (the globe, a world tab, an example, a header link). only mounted once the globe is in, so
// the session flag is read on the client
const SEEN = "cg-hero-seen";

function seen() {
  try {
    return sessionStorage.getItem(SEEN) === "1";
  } catch {
    return false;
  }
}

export function HeroTitle() {
  const [state, setState] = useState<"on" | "leaving" | "off">(() => (seen() ? "off" : "on"));
  useEffect(() => {
    if (state !== "on") return;
    const go = () => {
      try {
        sessionStorage.setItem(SEEN, "1");
      } catch {}
      setState("leaving");
    };
    window.addEventListener("pointerdown", go, { capture: true, once: true });
    return () => window.removeEventListener("pointerdown", go, { capture: true });
  }, [state]);
  if (state === "off") return null;
  return (
    // before the globe in the page, so the transparent globe canvas draws the earth over the letters
    <div aria-hidden className="hero-wrap pointer-events-none absolute inset-x-0 top-[9%] flex justify-center overflow-hidden px-4 pt-2 pb-6">
      <p className={`hero-title ${state === "leaving" ? "hero-leave" : ""}`} onAnimationEnd={(e) => e.animationName === "hero-out" && setState("off")}>
        Common Ground
      </p>
    </div>
  );
}
