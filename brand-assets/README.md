# SahakarLekha Brand Assets

Version-controlled brand foundation (Marketing Design System Phase 1).
Strategy lives in [docs/marketing/MARKETING-MASTER-PLAN.md](../docs/marketing/MARKETING-MASTER-PLAN.md).

```
logo/       B-02 logo masters (SVG, text baked as paths) + png/ exports + generator/
tokens/     B-03 design tokens (tokens.json = SSOT, tokens.css for HTML assets)
fonts/      OFL-licensed brand fonts (Hind, Inter)
templates/  B-04 template masters (coming next)
```

Rules of the road:
- **Naming:** `SL_<assetID>_<slug>_<lang>_<vMAJOR.MINOR>.<ext>` (lang omitted
  when language-neutral).
- **Colors/typography:** only from `tokens/tokens.json` — never eyeballed.
- **Heavy binaries** (video, PSD-scale files, print-ready PDFs > 2 MB) do NOT
  live in git — they go to the marketing vault (Drive), path mirrored to this
  structure. Small SVG/PNG masters stay here.
- Every released asset version gets a line in `docs/marketing/CHANGELOG.md`.
