# demo video: tour + voiceover

30 second tour of the real site for the Space Apps video. local only: `/demo` and the tour exist in dev (or a
production build with `NEXT_PUBLIC_DEMO=1`), never on the public site.

## recording

1. run the api and the site locally (`npm run dev` in `web/`), open `http://localhost:3000/` once and let the
   globe load (warms the map tiles), then open `http://localhost:3000/demo`
2. start the screen recording, click **Start**. the browser goes full screen and holds black for 8 s while it
   warms the scores and blocks, then the globe page opens with its loader. **that frame is 0:00**: trim everything
   before it
3. the tour ends black at about 0:30. press Esc to leave full screen

the step times live in `T` at the top of `web/src/components/demo/demo-director.tsx`. move a step there and the
matching line below together. the browser console prints `[demo] step at X ran at Y` for each step.

## what's on screen

| time | screen |
|---|---|
| 0:00 | loader, then the globe; "Common Ground" rises behind the Earth (~0:02) |
| 0:06 | cursor to Meteor Crater in Example sites, its pin lights up |
| 0:08 | click: title goes, the camera flies down, the block lifts out, panels slide in |
| 0:10.6 | cursor on the region score (81 out of 100 as a Moon stand-in) |
| 0:12 | result panel scrolls to the bars that add up to the score |
| 0:14 | Mars tab: the same place against Mars (69) |
| 0:16.6 | wireframe overlay toggled off and back on over the block |
| 0:19 | Best sites (Moon) |
| 0:21 | Mars tab, then Volcanic provinces |
| 0:23 | hover the ★ on #1: "Known location ... Mauna Loa" |
| 0:25 | How we know, scrolls through the method, charts and check sites |
| 0:28.4 | fade to black |

## voiceover (ElevenLabs, Adam Stone)

settings: stability ~50%, similarity ~60%, style 0, speaker boost on, speed 1.0. fill in the team name first.
66 words, about 28 s of speech at Adam's pace (78 words ran 33-35 s), plus pauses.

per line (most exact: one clip per line, placed at its start time):

| start | line | lands on |
|---|---|---|
| 0:00.0 | Hi, we're Team [TEAM NAME]. | globe loading |
| 0:01.9 | Astronauts train on Earth first. But where? | globe in, title rising |
| 0:05.1 | Meet Common Ground: Moon and Mars, on Earth. | title on screen |
| 0:08.6 | Pick a place. | click on Meteor Crater (0:08.0), camera flies down |
| 0:10.1 | We score it, | cursor on the score (0:10.6) |
| 0:11.4 | show why, | panel scrolls to the bars (0:12.1) |
| 0:12.4 | match it to thousands of NASA and JAXA Moon and Mars blocks, | Mars tab (0:14.2) under "Moon and Mars" |
| 0:17.0 | and overlay the closest. | wireframe off/on (0:16.6 / 0:17.5) |
| 0:19.0 | Our search found over a hundred new sites. | Best sites (0:19), Mars (0:21) |
| 0:22.4 | Stars mark known ones. | star card opens (0:23-0:24) |
| 0:24.9 | Tested on unseen land, so crews train on the right ground. | How we know scrolling, fade at 0:28.4 |

one-shot version (multilingual v2 / turbo), pauses placed to hit the same marks:

```
Hi, we're Team [TEAM NAME]. <break time="0.2s" /> Astronauts train on Earth first. But where? <break time="0.3s" /> Meet Common Ground: Moon and Mars, on Earth. <break time="0.2s" /> Pick a place. We score it, show why, match it to thousands of NASA and JAXA Moon and Mars blocks, and overlay the closest. <break time="0.4s" /> Our search found over a hundred new sites. <break time="0.6s" /> Stars mark known ones. <break time="0.8s" /> Tested on unseen land, so crews train on the right ground.
```

facts behind the lines (v3.0 v1): 4,636 Moon and Mars blocks from LRO, Kaguya (JAXA), MRO CTX and MOLA/HRSC; 127
distinct new places (157 picks) on the Best sites lists that are on no analog list we used; every validation figure
is measured on held-out areas.
