# B-04 Template Masters

Three systems: **social/video** (JSON → PNG), **A4 documents** (HTML →
print-to-PDF), **deck** (PPTX master). All brand-locked.

## Deck master (`deck/SL_B-04_deck-master_hien_v1.0.pptx`)

8 ready layouts: title · section divider · bullets · two-column+screenshot ·
stat cards · table · chart · closing. Each slide's **speaker notes** explain
what to edit. Copy the file, keep the layouts, replace the sample text.
**One-time setup on the presenting machine:** install the fonts from
`brand-assets/fonts` (select all TTFs → right-click → Install) — otherwise
Windows shows Devanagari in Nirmala UI (readable, but off-brand).
Regenerate the master itself: `npm run gen:deck` (layout changes = Brand
Book change — founder sign-off).

## A4 document (`document/SL_B-04_doc-a4_hien_v1.0.html`)

Copy → edit `<main>` → open in Chrome → Ctrl+P → Save as PDF (A4,
✓ Background graphics). Letterhead, tables, callouts, checklist, CTA box,
signature row, tricolor footer built in. Fonts load from the repo — offline OK.

# Social & Video (JSON-driven)

Brand-locked, JSON-driven social media templates. Layout, colors, logo,
tricolor strip are **law** (from the Brand Book); you edit only the words.

## Formats

| Key | Size | Use |
|---|---|---|
| `square` | 1080×1080 | Instagram/X/LinkedIn/Facebook post |
| `status` | 1080×1920 | WhatsApp status, Insta/FB story |
| `yt` | 1280×720 | YouTube thumbnail (screenshot slot right) |
| `og` | 1200×630 | Link-preview banners, X cards |

## How to make a post

1. Copy `content/sample.json` → `content/<campaign-name>.json`
   (or ask Claude: "नया status post बनाओ — topic X"). Include only the
   formats you need — each top-level key (`square`/`status`/`yt`/`og`)
   is optional.
2. Edit the text fields. Keep hooks SHORT (square/yt: ~14 chars per line —
   readable at thumbnail size).
3. Run:
   ```
   cd brand-assets/templates
   npm install   # first time only
   npm run gen
   ```
4. Collect `export/SL_B-04_<name>_<format>.png` (2× resolution) — SVGs land
   there too. `export/` is throwaway output; only content JSONs are kept.
5. YT thumbnails: paste a REAL product screenshot (demo data, names masked)
   over the dashed slot in any image editor — or ask Claude to composite it.

## Why there is no "editable SVG/Canva file"

Devanagari text in plain SVG renders broken in most tools (matras shift,
conjuncts split — resvg/Office/etc. don't shape Indic scripts reliably).
So the generator shapes every string with HarfBuzz (same engine as Chrome)
and bakes it to vector paths — output is pixel-identical everywhere.
The JSON **is** the editable layer. Layout changes = edit
`gen/gen-social.mjs` (that's a Brand Book change — founder sign-off needed).

## Field reference (all optional unless marked)

- `hook1` (required) / `hook2` — the big line(s). hook2 renders orange.
- `support` — one sentence (square/og) or array of lines (status).
- `badge` — short green pill, 2–4 words ("आज की टिप", "हिंदी · मुफ़्त").
- `checks` — status only: up to 3 bullet lines with drawn green checkmarks.
- `cta` — button text; defaults to "मुफ़्त शुरू करें". Domain line is locked.
