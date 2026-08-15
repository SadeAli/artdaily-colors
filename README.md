# Color Mixer — mix the exact target color by eye

An [Art Daily](https://artdaily.sadeali.com/) drill for color perception:
five target swatches per round, three sliders (hue / saturation /
lightness), and no numbers until you commit. Match by eye, lock it in,
and the reveal shows both H/S/L triples, how far off you were, and which
axis carried the miss ("biggest miss: lightness — yours lighter by 8").
Early colors are vivid; later ones go muted and near-neutral, where the
eye drifts most (the hint warns you when hue stops mattering). After the
fifth color a recap lines up all five target/mix pairs with their scores.

## Scoring

Both colors are converted hsl → sRGB → linear RGB → XYZ (D65) → Lab and
compared with CIE76 ΔE. A ΔE of 2 or less is below the eye's
just-noticeable difference and scores a full 100; from there the score
falls linearly to 0 at ΔE 32 ("plainly a different color"):
score = 100 · (1 − (ΔE − 2)/30), clamped to 0–100. The round score is
the mean of the five items.

## Run it

No build step, no dependencies:

```sh
python3 -m http.server 8080
# then visit http://localhost:8080
```

Part of [Art Daily](https://artdaily.sadeali.com/), the daily-practice
arcade — a [SadeAli](https://sadeali.com/) experiment.
