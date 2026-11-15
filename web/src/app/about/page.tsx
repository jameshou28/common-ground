import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "About" };

const DATA: [string, string, string][] = [
  ["Copernicus GLO-30", "ESA / Airbus", "Earth terrain at 30 m, read live for every click"],
  ["WorldCover 2021", "ESA", "Earth land cover at 10 m, for the conditions score"],
  ["LOLA global and polar DEMs", "NASA GSFC (Barker et al.)", "Moon terrain, including the south pole"],
  ["Kaguya (SELENE) terrain", "JAXA", "Moon terrain for the closest places"],
  ["MOLA–HRSC blended DEM", "NASA / ESA / DLR", "Mars terrain at 200 m"],
  ["CTX DTMs", "USGS Astrogeology", "Mars terrain for the closest places"],
  ["Blue Marble", "NASA, via GIBS", "Earth imagery from far out"],
  ["World Terrain and Moon / Mars tilesets", "Cesium ion", "The 3D globes"],
  ["Loading photos", "NASA", "Public domain"],
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-2 space-y-3 text-text-2">{children}</div>
    </section>
  );
}

export default function Page() {
  return (
    <main className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-xl leading-tight font-semibold">About</h1>
        <p className="mt-2 text-text-2">
          Common Ground scores how much a place on Earth looks like the Moon or Mars. It was built for NASA Space Apps 2026.
        </p>

        <Section title="Why">
          <p>
            Crews and rovers train on Earth before they fly. Meteor Crater, Iceland’s lava fields and the Atacama all got picked because they resemble somewhere else. Most of that
            picking has been done by eye. We wanted a number you can check, and a way to find places nobody has looked at yet.
          </p>
        </Section>

        <Section title="How a score is made">
          <p>
            When you click, the app cuts a 4 km block out of the Earth around that spot and reads its heights and land cover. The block gets described by its terrain: how much it rises and
            falls, how rough it is, its slopes, its craters and hollows, and its ridges, each at a few scales.
          </p>
          <p>
            That description is compared to regions of the Moon and Mars that were prepared ahead of time. Each region gets a landscape score from 0 to 100. Then it’s lowered for
            conditions that would get in the way of a real test site, like farmland or trees. The closest places inside the best region are listed with their own scores.
          </p>
          <p>
            The numbered points on a block are the 500 m cells that matched best and worst. Green helped the score, red hurt it.
          </p>
        </Section>

        <Section title="What it can't tell you">
          <p>
            The score is about the shape of the ground. It doesn’t know about rock type, dust, temperature, or whether you’d be allowed to drive a rover there. A high score is a place
            worth a closer look, not a finished site survey.
          </p>
          <p>Scores are only as good as the terrain data. Some places, mostly near the poles and over water, have gaps.</p>
        </Section>

        <Section title="Data">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-text-2">
              <tr className="border-b border-line">
                <th className="py-1.5 pr-3 font-medium">Dataset</th>
                <th className="py-1.5 pr-3 font-medium">From</th>
                <th className="py-1.5 font-medium">Used for</th>
              </tr>
            </thead>
            <tbody>
              {DATA.map(([name, from, use]) => (
                <tr key={name} className="border-b border-line align-top">
                  <td className="py-1.5 pr-3 text-text">{name}</td>
                  <td className="py-1.5 pr-3">{from}</td>
                  <td className="py-1.5">{use}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="Built with">
          <p>Next.js, Cesium and three.js on the site. FastAPI, NumPy and rasterio on the server. Scores are cached in Supabase and height grids are stored on Cloudflare R2.</p>
        </Section>
      </div>
    </main>
  );
}
