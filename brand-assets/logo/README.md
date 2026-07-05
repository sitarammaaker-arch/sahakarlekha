# SahakarLekha Logo Masters (B-02 v1.0)

All Devanagari/Latin text is **baked as vector paths** (Hind Bold / Inter
SemiBold outlines, shaped with HarfBuzz) — these SVGs render identically
everywhere, no fonts needed. **Never hand-edit path data**; change
`generator/gen.mjs` and re-run `npm run generate` inside `generator/`.

## Files & when to use which

| File | Use for |
|---|---|
| `SL_B-02_tile_v1.0.svg` | App icon, favicon source, WhatsApp/YouTube DP, watermark base |
| `SL_B-02_tile-mono-navy_v1.0.svg` | Single-color contexts on light bg (fax/photocopy-safe, stamps) |
| `SL_B-02_tile-mono-white_v1.0.svg` | Single-color contexts on dark/navy bg |
| `SL_B-02_logo-horizontal_v1.0.svg` | Default lockup on white/light backgrounds (letterhead, docs, site header) |
| `SL_B-02_logo-horizontal-reversed_v1.0.svg` | On navy/dark backgrounds (banners, video end-cards) |
| `SL_B-02_logo-stacked_v1.0.svg` | Square-ish placements (certificates, stamps, social posts) |
| `SL_B-02_logo-stacked-reversed_v1.0.svg` | Same, on dark backgrounds |
| `SL_B-02_logo-with-tagline_v1.0.svg` | Covers, title slides, brochure front — wherever the tagline earns its space |

## Rules (from the Brand Book — B-01)

- **Clear space:** keep empty space around the logo equal to ~25% of the tile
  height on all sides. Nothing enters it — not even the tricolor strip.
- **Minimum size:** tile 24px / 8mm; horizontal lockup 120px / 35mm wide.
  Below that, use the tile alone.
- **Colors:** only the four brand colors (`tokens/tokens.json`). Never recolor
  the tile, never put the orange tile on an orange/saffron background.
- **Misuse (never):** stretch/squash · rotate · drop shadows or glows ·
  outline the letterforms · re-typeset "सहकार लेखा" in another font · write the
  name as one word (it is always two: सहकार लेखा / Sahakar Lekha) · place on
  busy photos without a solid panel behind.
- **Tagline lockup** uses the approved tagline only:
  *सहकारी समितियों का अपना सॉफ्टवेयर* — do not swap in campaign slogans.

## Regenerating / exporting

```
cd generator
npm install        # once
npm run generate   # rewrites ../SL_B-02_*.svg
npm run export-png # writes ../png/ exports (tile 512/1024, lockups 2000w)
```
