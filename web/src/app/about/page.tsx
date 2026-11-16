import type { Metadata } from "next";
import type { ReactNode } from "react";
import { RepoLink } from "@/components/shell/repo-link";

export const metadata: Metadata = { title: "About" };

// every dataset the model, the site and the reference lists use
type Row = [name: string, from: string, use: string, href?: string];
const DATA: { group: string; rows: Row[] }[] = [
  {
    group: "Earth",
    rows: [
      ["Copernicus DEM GLO-30", "ESA / Airbus, AWS Open Data", "Earth terrain at 30 m, read live for every click", "https://registry.opendata.aws/copernicus-dem/"],
      ["ESA WorldCover 2021 (v200)", "ESA, CC BY 4.0", "Land cover at 10 m, for the surface score", "https://esa-worldcover.org"],
      ["WorldClim 2.1 precipitation", "Fick & Hijmans 2017", "Yearly rainfall, for the surface score", "https://www.worldclim.org"],
      ["Global Aridity Index v3.1", "Zomer et al. 2022, CC BY 4.0", "Tested as a surface input in v2.1, not used in the current model", "https://doi.org/10.6084/m9.figshare.7504448"],
    ],
  },
  {
    group: "Moon",
    rows: [
      ["LRO LOLA global DEM, 118 m", "NASA GSFC, via USGS Astrogeology", "Moon terrain for the 32 km view", "https://planetarymaps.usgs.gov"],
      ["LOLA south polar DEMs, 20 m and 80 m", "NASA GSFC PGDA (Barker et al.)", "Polar Moon terrain", "https://pgda.gsfc.nasa.gov"],
      ["Kaguya (SELENE) Terrain Camera DTMs", "JAXA, via the USGS STAC catalogue", "Moon terrain for the 4 km view and the closest places", "https://stac.astrogeology.usgs.gov"],
      ["LOLA 5 m site DEMs", "Barker et al. 2021", "The south polar target sites"],
      ["Unified Geologic Map of the Moon", "USGS (Fortezzo et al. 2020)", "Drawing the Moon regions", "https://astrogeology.usgs.gov"],
      ["Lunar crater database", "Robbins 2018", "Tagging crater features"],
    ],
  },
  {
    group: "Mars",
    rows: [
      ["CTX DTMs", "NASA MRO, via the USGS STAC catalogue", "Mars terrain for the 4 km view and the closest places", "https://stac.astrogeology.usgs.gov"],
      ["HRSC–MOLA blended DEM, 200 m", "NASA / ESA / DLR, via USGS Astrogeology", "Mars terrain for the 32 km view", "https://planetarymaps.usgs.gov"],
      ["Geologic Map of Mars (SIM 3292)", "USGS (Tanaka et al. 2014)", "Drawing the Mars regions", "https://pubs.usgs.gov/sim/3292/"],
      ["Mars crater database", "Robbins 2020", "Tagging crater features"],
    ],
  },
  {
    group: "Reference lists",
    rows: [
      ["Verified analog sites (114)", "ESA CAFE catalogue, NASA SP-2015-626 and peer-reviewed papers", "Training and testing the analog model"],
      ["Holocene volcanoes", "Smithsonian Global Volcanism Program", "Volcano examples, and places to search", "https://volcano.si.edu"],
      ["Known terrestrial impact sites", "USGS (Hunter 2020, CC0), diameters from Wikidata", "Crater examples"],
      ["Gazetteer of Planetary Nomenclature", "IAU / USGS", "Moon and Mars feature names and tags", "https://planetarynames.wr.usgs.gov"],
      ["GeoNames cities1000", "GeoNames, CC BY 4.0", "Place names on the Best sites lists", "https://www.geonames.org"],
      ["Landing sites", "NASA NSSDCA", "The Moon and Mars landmark pins"],
    ],
  },
  {
    group: "On the site",
    rows: [
      ["Cesium World Terrain and Moon / Mars tilesets", "Cesium ion", "The 3D globes"],
      ["Blue Marble", "NASA, via GIBS", "Earth imagery from far out"],
      ["NASA Image and Video Library", "NASA, public domain", "Photos in the hover cards and the loader", "https://images.nasa.gov"],
    ],
  },
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
    <main className="flex-1 overflow-y-auto p-6 max-md:p-4">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-xl leading-tight font-semibold">About</h1>
        <p className="mt-2 text-text-2">
          Common Ground scores how much any place on Earth looks like the Moon or Mars, explains why, and lists the best places it found. It was built for NASA Space Apps 2026.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-brand bg-raised px-4 py-3">
          <p className="min-w-0 flex-1">
            <b className="block font-semibold">The code is open source</b>
            <span className="text-sm text-text-2">The app, the scoring API and the model notebooks are all on GitHub.</span>
          </p>
          <RepoLink />
        </div>

        <Section title="How we approached it">
          <p>
            Crews and rovers train on Earth before they fly, at places like Meteor Crater, Iceland&apos;s lava fields and the Atacama. Most of those were picked by eye. We wanted a number
            anyone can check, and a way to find places nobody has looked at yet.
          </p>
          <p>
            We cut the Earth, the Moon and Mars into the same 4 km blocks and describe each one by the shape of its ground: slopes, roughness, ridges, hollows, craters, at two scales.
            A click compares your block with thousands of Moon and Mars blocks to find what it looks like, and a model trained on verified analog sites judges how good an analog it
            is. Land cover and rainfall decide how usable the ground is. Every result shows why it scored the way it did, and the whole model is tested on places it never saw; see
            How we know.
          </p>
        </Section>

        <Section title="Data">
          {DATA.map((g) => (
            <div key={g.group}>
              <h3 className="mt-4 text-xs font-semibold tracking-wide text-text uppercase">{g.group}</h3>
              <table className="mt-1 w-full text-left text-sm">
                <thead className="text-xs text-text-2">
                  <tr className="border-b border-line">
                    <th className="w-[34%] py-1.5 pr-3 font-medium">Dataset</th>
                    <th className="w-[30%] py-1.5 pr-3 font-medium">From</th>
                    <th className="py-1.5 font-medium">Used for</th>
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map(([name, from, use, href]) => (
                    <tr key={name} className="border-b border-line align-top">
                      <td className="py-1.5 pr-3 text-text">
                        {href ? (
                          <a href={href} target="_blank" rel="noreferrer" className="hover:text-brand">
                            {name}
                          </a>
                        ) : (
                          name
                        )}
                      </td>
                      <td className="py-1.5 pr-3">{from}</td>
                      <td className="py-1.5">{use}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </Section>

        <Section title="Built with">
          <p>Next.js, Cesium and three.js on the site. FastAPI, NumPy, SciPy and rasterio on the server. Scores are cached in Supabase and height grids are stored on Cloudflare R2.</p>
        </Section>
      </div>
    </main>
  );
}
