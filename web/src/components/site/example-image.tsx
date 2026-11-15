"use client";

import { HoverCard } from "radix-ui";
import images from "../../../public/examples/examples.json";

// a nasa photo of what a region or landform looks like, with a line on what it is, on hover or keyboard focus. it
// eases in after a short pause, like a wikipedia link preview. keys are region ids ("moon:maria") or landform tags
// ("wrinkle_ridge"); public/examples/examples.json lists the file, photo title and credit
type Img = { src: string; title: string; credit: string; nasa_id: string };
const IMAGES = images as Record<string, Img>;

const ABOUT: Record<string, { name: string; text: string }> = {
  "moon:maria": { name: "Lunar maria", text: "Dark, smooth plains of basalt lava that flooded huge impact basins 3 to 3.8 billion years ago. Most crewed landings went here." },
  "moon:highlands": { name: "Lunar highlands", text: "The bright, heavily cratered crust: the Moon's oldest surface, mostly pale anorthosite rock." },
  "moon:basins": { name: "Impact basins", text: "Impacts hundreds of kilometres across, ringed by mountains and blankets of ejecta, like the 930 km Orientale basin." },
  "moon:south_pole": { name: "South polar region", text: "Rugged cratered ground where the Sun skims the horizon and crater floors in permanent shadow trap ice. The Artemis landing area." },
  "mars:highlands": { name: "Southern cratered highlands", text: "The old, heavily cratered southern half of Mars, cut by ancient river valleys." },
  "mars:lowlands": { name: "Northern lowlands", text: "Smooth northern plains several kilometres lower than the highlands, with ice just below the surface." },
  "mars:volcanic": { name: "Volcanic provinces", text: "Tharsis and Elysium: giant shield volcanoes and lava plains, Olympus Mons among them." },
  "mars:outflow": { name: "Outflow channels and chaos", text: "Channels carved by huge floods that burst out of the ground, often starting in broken-up chaos terrain." },
  wrinkle_ridge: { name: "Wrinkle ridge", text: "A low, winding ridge on lava plains, where the surface was squeezed and buckled." },
  sinuous_rille: { name: "Sinuous rille", text: "A winding channel cut by flowing lava, or a collapsed lava tube, like Hadley Rille at the Apollo 15 site." },
  crater_floor: { name: "Crater floor", text: "The floor inside a large crater: flat or hummocky, often with a central peak and pools of impact melt." },
  crater_rim: { name: "Crater rim", text: "The raised edge of an impact crater, made of rock layers thrown up and out by the impact." },
  small_crater: { name: "Small crater", text: "A small bowl-shaped crater with a sharp rim, the simplest kind of impact crater." },
  crater_chain: { name: "Crater chain", text: "A line of craters, from a string of impacts or from collapse along an underground fracture." },
  graben: { name: "Graben", text: "A long trough where the crust pulled apart and a block dropped between two faults." },
  massif: { name: "Massif", text: "A large block of mountains, often part of a basin's ring, like Mount Hadley at the Apollo 15 site." },
  mesa: { name: "Mesa", text: "A flat-topped hill with steep sides, left standing as the layers around it eroded away." },
  yardang: { name: "Yardang", text: "A streamlined ridge carved by wind out of soft rock, lined up with the wind." },
  chaos: { name: "Chaos terrain", text: "Ground broken into jumbled blocks and mesas, where buried ice or water is thought to have escaped." },
  canyon: { name: "Canyon", text: "A deep, steep-walled valley. Valles Marineris runs about 4,000 km and is up to 7 km deep." },
  scarp: { name: "Scarp", text: "A steep step in the ground. Lobate scarps are faults where the crust was pushed together." },
  channel: { name: "Channel", text: "A valley carved by flowing water, including the giant flood channels that drained into the northern plains." },
  volcanic_edifice: { name: "Volcano", text: "A volcano's cone or shield, built up layer by layer from lava." },
  lava_flow: { name: "Lava flow", text: "A sheet of cooled lava with lobed edges, ridges and a rough or ropy surface." },
};

export const hasExample = (key: string | null | undefined) => !!key && key in IMAGES;

export function ExampleImage({ k, children }: { k: string | null | undefined; children: React.ReactNode }) {
  const img = k ? IMAGES[k] : undefined;
  if (!img || !k) return <>{children}</>;
  const about = ABOUT[k];
  return (
    <HoverCard.Root openDelay={350} closeDelay={120}>
      <HoverCard.Trigger asChild>
        <span tabIndex={0} className="cursor-help underline decoration-line-2 decoration-dotted underline-offset-2">
          {children}
        </span>
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          side="bottom"
          align="start"
          sideOffset={8}
          collisionPadding={12}
          className="z-[60] w-72 origin-(--radix-hover-card-content-transform-origin) overflow-hidden rounded-lg border border-line bg-panel text-xs font-normal shadow-2xl duration-200 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          {/* a static nasa image from public/, next/image has nothing to add */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img.src} alt={img.title} className="aspect-[16/10] w-full bg-raised object-cover" />
          <div className="px-3 pt-2.5 pb-3">
            {about && <p className="text-[13px] font-semibold text-text">{about.name}</p>}
            {about && <p className="mt-1 leading-snug text-text">{about.text}</p>}
            <p className="mt-2 text-[11px] text-text-2">
              Photo: {img.title} · {img.credit} ({img.nasa_id})
            </p>
          </div>
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}
