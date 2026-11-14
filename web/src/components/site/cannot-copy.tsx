import type { Tab } from "@/lib/regions";

// what terrain similarity cannot give, so nobody reads the score as "the same place"
const LIMITS: Record<Tab, [string, string][]> = {
  moon: [
    ["Gravity", "1.62 m/s² on the Moon, 9.81 m/s² here."],
    ["Vacuum", "No air at the lunar surface. No open-air site on Earth comes close."],
    ["Radiation", "1,369 µSv a day on the lunar surface (Chang'e 4), against 731 on the ISS."],
    ["Cold", "Permanently shadowed ground near the pole stays below −200 °C."],
  ],
  mars: [
    ["Gravity", "3.71 m/s² on Mars, 9.81 m/s² here."],
    ["Air", "Under 1% of Earth's surface pressure, almost all carbon dioxide."],
    ["Radiation", "About 670 µSv a day on the surface (Curiosity), far above any place on Earth."],
  ],
};

export function CannotCopy({ world }: { world: Tab }) {
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-xs">
      {LIMITS[world].map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="font-semibold">{k}</dt>
          <dd className="text-text-2">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
