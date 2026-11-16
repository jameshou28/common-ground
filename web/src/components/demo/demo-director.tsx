"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { DEMO_ON, DEMO_START } from "@/lib/demo";
import { env } from "@/lib/env";
import { EXAMPLES, exampleTile } from "@/lib/examples";
import { siteHref } from "@/lib/sites";

// a scripted 30 second tour of the real site for the submission video, started from /demo. it drives the app the
// way a person would (a drawn cursor, real clicks and hovers), so what's recorded is the actual site. local only,
// see lib/demo.ts

const EXAMPLE = EXAMPLES.find((e) => e.id === "meteor-crater") ?? EXAMPLES[0];
const SITE_HREF = siteHref(exampleTile(EXAMPLE), { tab: EXAMPLE.tab });

// seconds after the globe page opens (the loader). the voiceover script in docs/demo-voiceover.md uses the same
// clock; move a step here and the matching line there together
const T = {
  hoverExample: 6.0,
  clickExample: 8.0,
  pointScore: 10.6,
  showBars: 12.1,
  marsTab: 14.2,
  wireOff: 16.6,
  wireOn: 17.5,
  bestSites: 19.0,
  bestMars: 21.0,
  bestVolcanic: 22.1,
  hoverStar: 22.9,
  howWeKnow: 25.0,
  scrollDown: 25.9,
  fade: 28.4,
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// an element that may not be there yet: polls until it is, or gives up and the step is skipped
async function find(get: () => Element | null | undefined, timeoutMs = 6000): Promise<HTMLElement | null> {
  const end = performance.now() + timeoutMs;
  while (performance.now() < end) {
    const el = get();
    if (el instanceof HTMLElement && el.getBoundingClientRect().width > 0) return el;
    await sleep(80);
  }
  console.warn("[demo] not found in time:", get.toString());
  return null;
}
// the innermost element under sel whose text includes text
const byText = (sel: string, text: string) => () =>
  [...document.querySelectorAll(sel)].filter((e) => e.textContent?.includes(text)).sort((a, b) => (a.textContent?.length ?? 0) - (b.textContent?.length ?? 0))[0];

// eased scroll over a set time; native smooth scrolling is too quick to read on video
function scrollOver(el: HTMLElement, to: number, ms: number) {
  const from = el.scrollTop;
  const t0 = performance.now();
  return new Promise<void>((done) => {
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      el.scrollTop = from + (to - from) * e;
      if (k < 1) requestAnimationFrame(step);
      else done();
    };
    requestAnimationFrame(step);
  });
}

// warm everything the tour opens, so nothing waits on the network or on dev compiles while recording
async function prewarm() {
  const get = (u: string) => fetch(u).catch(() => null);
  const abs = (u: string) => (u.startsWith("http") ? u : `${env.gridBase}${u}`);
  await Promise.all([get("/"), get(SITE_HREF), get("/best?tab=mars&list=mars%3Avolcanic"), get("/best"), get("/how-we-know")]);
  try {
    const r = await (
      await fetch(`${env.apiUrl}/score`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tile_id: exampleTile(EXAMPLE) }) })
    ).json();
    const jobs: Promise<unknown>[] = [get(abs(r.grid_url))];
    const idxs = new Set<number>();
    for (const w of ["moon", "mars"]) {
      const W = r.worlds?.[w];
      if (W?.best_match?.index != null) idxs.add(W.best_match.index);
      for (const g of W?.regions ?? []) for (const s of (g.best ?? []).slice(0, 1)) idxs.add(s.index);
    }
    for (const idx of idxs) {
      for (const pad of ["?pad=true", ""])
        jobs.push(
          fetch(`${env.apiUrl}/library/${idx}${pad}`)
            .then((x) => x.json())
            .then((j) => get(abs(j.grid_url)))
            .catch(() => null),
        );
    }
    await Promise.all(jobs);
  } catch (e) {
    console.warn("[demo] prewarm failed, the tour will still run", e);
  }
}

export function DemoDirector() {
  const router = useRouter();
  const cursor = useRef<HTMLDivElement>(null);
  const black = useRef<HTMLDivElement>(null);
  const running = useRef(false);

  useEffect(() => {
    if (!DEMO_ON) return;
    const html = document.documentElement;
    const stop = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      running.current = false;
      html.classList.remove("cg-demo");
      if (black.current) black.current.style.opacity = "0";
      if (cursor.current) cursor.current.style.opacity = "0";
    };
    window.addEventListener("keydown", stop);

    const start = async () => {
      if (running.current) return;
      running.current = true;
      html.classList.add("cg-demo");
      // the dev badge sits in a shadow root the page css can't reach; hidden by hand for the length of the tour
      const badge = setInterval(() => document.querySelectorAll<HTMLElement>("nextjs-portal").forEach((n) => n.style.setProperty("display", "none", "important")), 250);
      setTimeout(() => clearInterval(badge), 60000);
      try {
        sessionStorage.removeItem("cg-hero-seen");
      } catch {}
      const c = cursor.current!;
      const fadeBlack = black.current!;

      // the cursor glides to the middle of an element (or a point inside it)
      const moveTo = async (el: HTMLElement, ms = 900, fx = 0.5, fy = 0.5) => {
        const b = el.getBoundingClientRect();
        c.style.transitionDuration = `${ms}ms, 200ms, 150ms`;
        c.style.opacity = "1";
        c.style.translate = `${b.left + b.width * fx}px ${b.top + b.height * fy}px`;
        await sleep(ms);
      };
      const hover = (el: HTMLElement) => {
        const o = { bubbles: true, pointerType: "mouse" as const };
        el.dispatchEvent(new PointerEvent("pointerover", o));
        el.dispatchEvent(new PointerEvent("pointerenter", { ...o, bubbles: false }));
        el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
      };
      const unhover = (el: HTMLElement) => {
        const o = { bubbles: true, pointerType: "mouse" as const, relatedTarget: document.body };
        el.dispatchEvent(new PointerEvent("pointerout", o));
        el.dispatchEvent(new PointerEvent("pointerleave", { ...o, bubbles: false }));
        el.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, relatedTarget: document.body }));
      };
      const click = async (el: HTMLElement) => {
        c.style.scale = "0.8";
        el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "mouse" }));
        await sleep(120);
        c.style.scale = "1";
        el.click();
      };

      // the freeze: /demo stays black for 8 s (longer only if warming takes longer), then the site starts from its loader
      await Promise.all([prewarm(), sleep(8000)]);
      if (!running.current) return;
      c.style.transitionDuration = "0ms";
      c.style.translate = `${window.innerWidth * 0.82}px ${window.innerHeight * 0.88}px`;
      c.style.opacity = "0";
      router.push("/");
      const t0 = performance.now();
      const at = async (s: number) => {
        const wait = t0 + s * 1000 - performance.now();
        if (wait > 0) await sleep(wait);
        console.info(`[demo] step at ${s.toFixed(1)}s ran at ${((performance.now() - t0) / 1000).toFixed(1)}s`);
        return running.current;
      };

      // 1. the example list: hover lights its pin, then open it
      if (!(await at(T.hoverExample))) return;
      const ex = await find(byText('section[aria-labelledby="examples"] button', EXAMPLE.name));
      if (ex) {
        await moveTo(ex, 1100, 0.3);
        hover(ex);
      }
      if (!(await at(T.clickExample))) return;
      if (ex) {
        await click(ex);
        unhover(ex);
      }

      // 2. the score, then the bars that explain it
      if (!(await at(T.pointScore))) return;
      const gauge = await find(byText('aside[aria-label="Result"] *', "Region score"), 5000);
      if (gauge) await moveTo(gauge, 900, 0.4, 2.5);
      if (!(await at(T.showBars))) return;
      const pane = document.querySelector<HTMLElement>('aside[aria-label="Result"] > div.overflow-y-auto');
      const bars = await find(() => document.querySelector('aside[aria-label="Result"] [aria-label="Which score to explain"]'), 4000);
      if (pane && bars) {
        const to = pane.scrollTop + bars.getBoundingClientRect().top - pane.getBoundingClientRect().top - 24;
        void moveTo(bars, 1200, 0.5, 3);
        await scrollOver(pane, to, 1100);
      }

      // 3. the same place against mars
      if (!(await at(T.marsTab))) return;
      const mars = await find(byText('nav[aria-label="World"] a', "Mars"));
      if (mars) {
        await moveTo(mars, 800);
        await click(mars);
        if (pane) void scrollOver(pane, 0, 900);
      }

      // 4. the wireframe: off and back on, so the eye finds it
      if (!(await at(T.wireOff))) return;
      // enabled once the mars block's grid is in
      const wire = await find(() => {
        const b = byText("button", "Overlay the match as wireframe")();
        return b instanceof HTMLButtonElement && !b.disabled ? b : null;
      });
      if (wire) {
        await moveTo(wire, 700);
        await click(wire);
        if (!(await at(T.wireOn))) return;
        await click(wire);
      }

      // 5. best sites: the moon list, the mars list, then the star on a known site
      if (!(await at(T.bestSites))) return;
      const best = await find(byText("header a", "Best sites"));
      if (best) {
        await moveTo(best, 900);
        await click(best);
      }
      if (!(await at(T.bestMars))) return;
      const bm = await find(byText('main nav[aria-label="World"] a', "Mars"));
      if (bm) {
        await moveTo(bm, 700);
        await click(bm);
      }
      if (!(await at(T.bestVolcanic))) return;
      const volc = await find(() => document.querySelector('main a[href*="list=mars%3Avolcanic"]'));
      if (volc) {
        await moveTo(volc, 600, 0.3);
        await click(volc);
      }
      if (!(await at(T.hoverStar))) return;
      const star = await find(() => document.querySelector('main [aria-label="Known analog location"]'));
      if (star) {
        await moveTo(star, 700);
        hover(star);
      }

      // 6. how we know, read top to bottom
      if (!(await at(T.howWeKnow))) return;
      if (star) unhover(star);
      const hwk = await find(byText("header a", "How we know"));
      if (hwk) {
        await moveTo(hwk, 700);
        await click(hwk);
      }
      if (!(await at(T.scrollDown))) return;
      const main = await find(() => (location.pathname === "/how-we-know" ? document.querySelector("main.overflow-y-auto") : null));
      if (main) {
        c.style.opacity = "0";
        await scrollOver(main, Math.min(main.scrollHeight - main.clientHeight, window.innerHeight * 2.4), (T.fade - T.scrollDown) * 1000);
      }

      // 7. fade to black and hold; Esc gives the page back
      if (!(await at(T.fade))) return;
      fadeBlack.style.opacity = "1";
      running.current = false;
    };
    window.addEventListener(DEMO_START, start);
    return () => {
      window.removeEventListener(DEMO_START, start);
      window.removeEventListener("keydown", stop);
    };
  }, [router]);

  if (!DEMO_ON) return null;
  return (
    <>
      <div
        ref={cursor}
        aria-hidden
        className="pointer-events-none fixed top-0 left-0 z-[200] opacity-0"
        style={{ transitionProperty: "translate, opacity, scale", transitionDuration: "900ms, 200ms, 150ms", transitionTimingFunction: "cubic-bezier(0.45, 0, 0.2, 1)" }}
      >
        {/* an arrow pointer, tip at the element's point */}
        <svg width="26" height="30" viewBox="0 0 26 30" className="drop-shadow-[0_2px_4px_rgb(0_0_0_/_0.6)]">
          <path d="M2 2 L2 24 L8 18.5 L12.5 28 L16.5 26 L12 17 L20 17 Z" fill="#fff" stroke="#111" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      </div>
      <div ref={black} aria-hidden className="pointer-events-none fixed inset-0 z-[300] bg-black opacity-0 transition-opacity duration-[1400ms] ease-in" />
    </>
  );
}
