"use client";

import { useEffect, useState } from "react";

// nasa public domain photos, earth, moon and mars taking turns
const PHOTOS = [
  ["earth", "Earth from orbit"],
  ["moon", "The full Moon"],
  ["mars", "Mars from Viking"],
  ["meteor-crater", "Meteor Crater from the ISS"],
  ["apollo-11", "Buzz Aldrin on the Moon"],
  ["curiosity", "Curiosity on Mars"],
  ["earthrise", "Earthrise from Apollo 8"],
  ["lunar-crater", "A lunar crater"],
  ["mount-sharp", "Mount Sharp on Mars"],
] as const;
const STEP_MS = 700;

// fills the panel while a new block is scored, mounted only while the score is pending
export function ScoreLoader({ name }: { name: string }) {
  // ms since scoring started
  const [t, setT] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const id = setInterval(() => setT(performance.now() - start), 80);
    return () => clearInterval(id);
  }, []);
  // ponytail: fake progress, the score endpoint reports none
  const count = Math.min(97, Math.round(100 * (1 - Math.exp(-t / 2500))));
  const i = Math.floor(t / STEP_MS) % PHOTOS.length;

  return (
    <div role="status" aria-live="polite" className="mx-auto mt-6 w-40">
      <p className="flex justify-between text-[11px] font-medium tracking-wider uppercase">
        <span className="truncate pr-3">{name}</span>
        <span className="tabular-nums">{count}</span>
      </p>
      {/* all photos stacked in one fixed frame, the current one fades in over the last */}
      <div className="relative mt-1.5 aspect-square overflow-hidden bg-raised">
        {PHOTOS.map(([f, alt], k) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={f} src={`/loader/${f}.jpg`} alt={k === i ? alt : ""} className="score-loader-photo" data-on={k === i ? "" : undefined} />
        ))}
      </div>
      <p className="mt-2 text-center text-[11px] text-text-2">A new place takes a few seconds.</p>
    </div>
  );
}
