# Color Mixer — mix the exact target color by eye

An [Art Daily](https://artdaily.sadeali.com/) drill for color perception:
five target swatches per round, three sliders (hue / saturation /
lightness), and no numbers until you commit. Match by eye, lock it in,
and the reveal shows both H/S/L triples plus how far off you were.
Early colors are vivid; later ones go muted and near-neutral, where the
eye drifts most.

## Scoring

Both colors are converted hsl → sRGB → linear RGB → XYZ (D65) → Lab and
compared with CIE76 ΔE. Item score = 100 · (1 − ΔE/32), clamped to 0–100;
the round score is the mean of the five items. A ΔE under ~2 is "can't
tell them apart"; 32 is plainly a different color.

## Run it

No build step, no dependencies:

```sh
python3 -m http.server 8080
# then visit http://localhost:8080
```

Part of [Art Daily](https://artdaily.sadeali.com/), the daily-practice
arcade — a [SadeAli](https://sadeali.com/) experiment.
