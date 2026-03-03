# Food Distribution Tycoon

A web-only, fast-cycle tycoon game where you run Springfield Fine Foods (Springfield, IL) and compete against Sysco over 8 periods (2 years).

## Run locally

Because this is a static SPA, run any local server from the repo root:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Game structure

Each period has three phases:
1. **Plan Phase** (set GTM, margin, ops levers)
2. **Sim Phase** (10–15 second 2D animated montage on canvas)
3. **Results Phase** (P&L, KPI review, valuation math, narrative recap)

## Tuning knobs

All key balancing/tuning values are in:

- `config/gameConfig.js`

This includes:
- segment market/spend baselines
- acquisition and retention coefficients
- cost coefficients and fixed costs
- event probabilities and impacts
- valuation multiple adjustments

## Code layout

- `engine/` — deterministic simulation + valuation logic
- `ui/` — rendering for plan/sim/results screens
- `assets/` — static art/icons (placeholder folder for future sprites)
- `config/` — centralized game tuning

## Persistence

Game state is saved to `localStorage` under key:
- `food-distribution-tycoon-save-v1`

Use **New Game** in the header to reset.
