# Thermometer Check

Interactive Minnesota CD-1 map showing regional fundraising progress (thermometer) for Jake Johnson for Congress.

Built from the Town Hall Tracker codebase: same map geometry, zoom, and region/county hover–click pattern; new Google Sheet data layer and thermometer UI.

## Stack

- React + Vite + TypeScript
- SVG map geometry (same Figma-normalized counties as the town hall map)
- Google Sheets for live thermometer data

## Setup

```bash
npm install
cp .env.example .env
# set VITE_GOOGLE_SHEET_ID (and optionally API key / gid)
npm run dev
```

## Google Sheets

Tab: **Thermometer Dashboard**

| Form Name | Raised | Goal | % of Goal | Thermometer | Last Updated |
|-----------|--------|------|-----------|-------------|--------------|

### Fetch approach (pick one)

**Published CSV (default if no API key)** — simpler. Share the sheet as “Anyone with the link can view,” set `VITE_GOOGLE_SHEET_ID` and `VITE_GOOGLE_SHEET_GID` for the Thermometer Dashboard tab. No quota or API key. Tradeoff: Google’s CSV export can lag a few minutes behind live edits.

**Sheets API v4 (when `VITE_GOOGLE_SHEETS_API_KEY` is set)** — fresher reads against `VITE_GOOGLE_SHEET_RANGE` (default `Thermometer Dashboard!A2:F`). Tradeoff: needs a Google Cloud API key with Sheets API enabled, and is subject to quota.

Data refreshes on load and every **5 minutes** (`VITE_REFRESH_INTERVAL_MS`).

## Region groupings

Edit **`src/data/regionCounties.ts`** only. Keys must match Sheet **Form Name** values; county names must match map layers (e.g. `Blue Earth County`).

Map fill: each region has its own pastel hue; counties in a region share that color and darken as `% of Goal` rises.

## Interaction

- Landing view: overview grid of all region thermometers
- Click a region card or any county in that region on the map → detail panel (raised, goal, %, last updated)
- Map fill: each region has its own pastel hue; darker = closer to goal
- Missing Sheet row → **Data pending** (does not break the UI)
- Failed Sheet fetch → clear error state (map hidden until a successful load)

## Branding

JJFC navy / gold tokens are reused from the town hall app. Region pastel hues live in `src/utils/regionColors.ts`.
