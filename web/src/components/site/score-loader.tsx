"use client";

import { useEffect, useState } from "react";

import examples from "../../../public/examples/examples.json";

// nasa public domain photos, earth, moon and mars taking turns: the loader set, then the region and landform examples
const LOADER = [
  ["earth", "Earth from orbit"],
  ["moon", "The full Moon"],
  ["mars", "Mars from Viking"],
  ["meteor-crater", "Meteor Crater from the ISS"],
  ["apollo-11", "Buzz Aldrin on the Moon"],
  ["curiosity", "Curiosity on Mars"],
  ["earthrise", "Earthrise from Apollo 8"],
  ["lunar-crater", "A lunar crater"],
  ["mount-sharp", "Mount Sharp on Mars"],
  ["grand-canyon", "The Grand Canyon from the ISS"],
  ["far-side", "The far side of the Moon"],
  ["gale-crater", "Gale Crater on Mars"],
  ["sahara", "The Sahara coast from the ISS"],
  ["apollo-15", "The Apollo 15 rover at Hadley"],
  ["jezero", "The Jezero delta on Mars"],
  ["lunar-highlands", "The Apollo 16 lander"],
  ["perseverance", "Perseverance on Mars"],
  ["valles-marineris", "Valles Marineris on Mars"],
] as const;
const PHOTOS: { src: string; alt: string }[] = [];
// interleave the two sets so earth, moon and mars keep alternating
const EXTRA = Object.values(examples as Record<string, { src: string; title: string }>).map((e) => ({ src: e.src, alt: e.title }));
for (let k = 0; k < Math.max(LOADER.length, EXTRA.length); k++) {
  if (k < LOADER.length) PHOTOS.push({ src: `/loader/${LOADER[k][0]}.jpg`, alt: LOADER[k][1] });
  if (k < EXTRA.length) PHOTOS.push(EXTRA[k]);
}
const STEP_MS = 1400;

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
    <div role="status" aria-live="polite" className="mx-auto mt-6 w-56">
      <p className="flex justify-between text-[11px] font-medium tracking-wider uppercase">
        <span className="truncate pr-3">{name}</span>
        <span className="tabular-nums">{count}</span>
      </p>
      {/* all photos stacked in one fixed frame, the current one fades in over the last */}
      <div className="relative mt-1.5 aspect-square overflow-hidden bg-raised">
        {/* only the previous, current and next photos are mounted, so 42 photos aren't fetched at once */}
        {PHOTOS.map((p, k) =>
          k === i || k === (i + 1) % PHOTOS.length || k === (i - 1 + PHOTOS.length) % PHOTOS.length ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={p.src} src={p.src} alt={k === i ? p.alt : ""} className="score-loader-photo" data-on={k === i ? "" : undefined} />
          ) : null,
        )}
      </div>
      <p className="mt-2 text-center text-[11px] text-text-2">A new place takes a few seconds.</p>
    </div>
  );
}
