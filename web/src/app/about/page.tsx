import type { Metadata } from "next";

export const metadata: Metadata = { title: "About" };

const DATA: [name: string, use: string, href: string][] = [
  ["Copernicus DEM GLO-30", "30 m elevation for every Earth block. © DLR e.V. 2010 to 2014 and © Airbus Defence and Space GmbH 2014 to 2018, provided under COPERNICUS by the European Union and ESA.", "https://registry.opendata.aws/copernicus-dem/"],
  ["LOLA 5 m south pole site models", "Elevation for the two Moon targets. Barker et al. 2021, NASA Goddard Planetary Geodesy Data Archive.", "https://pgda.gsfc.nasa.gov/products/78"],
  ["NASA Blue Marble", "The zoomed-out Earth, served by NASA GIBS.", "https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api"],
  ["Cesium ion", "Earth terrain and aerial imagery, and the Moon and Mars globes.", "https://cesium.com/platform/cesium-ion/content/"],
];

const SOFTWARE: [name: string, href: string][] = [
  ["CesiumJS", "https://cesium.com/platform/cesiumjs/"],
  ["three.js", "https://threejs.org/"],
  ["React Three Fiber", "https://r3f.docs.pmnd.rs/"],
  ["Recharts", "https://recharts.org/"],
  ["Next.js", "https://nextjs.org/"],
  ["FastAPI", "https://fastapi.tiangolo.com/"],
];

export default function Page() {
  return (
    <main className="flex-1 overflow-y-auto p-6">
      <article className="mx-auto max-w-3xl [&_a]:text-brand [&_h2]:mt-8 [&_h2]:text-base [&_h2]:font-semibold [&_section>p]:mt-2 [&_section>p]:text-text-2">
        <h1 className="text-xl leading-tight font-semibold">About Analog Explorer</h1>
        <p className="mt-2 text-text-2">
          Built for the NASA Space Apps Challenge 2026, Earth Analogs. Click a place on Earth, see its 4 km block of terrain, and get a score for how well it stands in for a Moon or Mars target, with the reasons.
        </p>

        <section>
          <h2>Data</h2>
          <ul className="mt-2 space-y-2">
            {DATA.map(([name, use, href]) => (
              <li key={name}>
                <a href={href} target="_blank" rel="noreferrer">
                  {name}
                </a>
                <span className="block text-text-2">{use}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2>Software</h2>
          <p>
            {SOFTWARE.map(([name, href], i) => (
              <span key={name}>
                {i > 0 && ", "}
                <a href={href} target="_blank" rel="noreferrer">
                  {name}
                </a>
              </span>
            ))}
            .
          </p>
        </section>

        <section>
          <h2>Use of AI</h2>
          <p>
            Much of the application code was written with Claude, an AI model from Anthropic, working under the team&apos;s direction. The team chose the design, the data and the method, and checked the results against the real services.
          </p>
          <p>No image, sound or video in the app is AI-generated. The terrain, the imagery and every measurement come from the sources listed above.</p>
          <p>
            Before the event the team explored how the globe should behave in a throwaway prototype and drew a static mockup of the screens. The application here was written during the event.
          </p>
        </section>

        <section>
          <h2>Team</h2>
          <p>James: front end, back end and data preparation. Victor: the scoring model.</p>
        </section>

        <section>
          <h2>What the score is not</h2>
          <p>
            A high score means the terrain and the light resemble the target. No place on Earth reproduces lunar gravity, vacuum or radiation, and the result page says so under &quot;What no Earth site can copy&quot;.
          </p>
        </section>
      </article>
    </main>
  );
}
