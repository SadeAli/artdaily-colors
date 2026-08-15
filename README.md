# Color Mixer — mix the exact target color by eye

An [Art Daily](https://artdaily.sadeali.com/) drill for color perception:
five target swatches per round, three sliders (hue / saturation /
lightness), and no numbers until you commit. Match by eye, lock it in,
and the reveal shows both H/S/L triples, how far off you were, and which
axis carried the miss ("biggest miss: lightness — yours lighter by 8").
The first color is an easy warm-up; then vivid, then muted, ending
near-grey, where the eye drifts most (the hint warns you when hue stops
mattering). After the
fifth color a recap lines up all five target/mix pairs with their scores.

## Scoring

Both colors are converted hsl → sRGB → linear RGB → XYZ (D65) → Lab and
compared with CIE76 ΔE. A ΔE of 2 or less is below the eye's
just-noticeable difference and scores a full 100; from there the score
falls linearly to 0 at a zero point that SCALES WITH THE TARGET'S OWN
CHROMA (about ΔE 45 on a vivid colour, about 20 on a near-grey), so a
10° hue miss costs roughly the same on every item; the first two items
carry a small extra allowance so the warm-up is a real first win. The
round score is the mean of the five items.

## What changed in the input-fairness pass

The zero point of the score now scales with the target's own chroma, so
being 10° off costs about the same on a vivid colour as on a near-grey.
Before this the vivid items — which came first — were several times
harder to score than the muted ones, so the first number a beginner saw
was the worst of their round; item 1 is now an easy warm-up and the ramp
runs the way the how-to always claimed. Each slider carries ±1 stepper
buttons for exact landings without thumb-luck, the verdict leads with
plain English and puts ΔE second, and ΔE is defined inline on the first
reveal of every round.

## Input fairness

Scores are only ever compared against your own history, so the drill
eases its tolerances for the hardware in your hand and says which one it
eased for (the "scoring for…" chip in the HUD). A pen keeps the strict
reference; a mouse or trackpad, which pivots at the wrist and cannot
creep, gets roughly double the room; a finger sits between. Start and
grab zones move the other way — a screenless tablet needs the *biggest*
targets, because the hand is out of sight. Relative tolerances carry an
absolute pixel floor so a phone is never held to a stricter standard
than a desktop for the same drill.

## Run it

No build step, no dependencies:

```sh
python3 -m http.server 8080
# then visit http://localhost:8080
```

Part of [Art Daily](https://artdaily.sadeali.com/), the daily-practice
arcade — a [SadeAli](https://sadeali.com/) experiment.
