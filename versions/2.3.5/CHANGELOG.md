# Changelog — v2.3.5

## Performance overlay — user-tuned layout (final)

- **Vertical performance window**: resized to **202×265** (links variant 309px) with 16px rings, 16px values, and grid columns `28px | 16px | 50px | 16px | 40px`.
- **Horizontal performance bar**: window **495×50**; metric cards fixed at **100×40px** with a uniform **2px** gap; RAM track widened to 102px for `11.4 GB`; FPS card absorbs remaining width (~150px).
- **User layout-editor overrides applied verbatim**: all ring/value/unit nudges converted to CSS `translate` rules (preserving the rings' `rotate(-90deg)` gauge transform), including per-row vertical optical alignment fixes.
- **Control glyphs**: uniform 12px text controls (`≡`/`−`/`×`) with green/yellow/red hover states and even 2px spacing.
- **Dev tooling**: layout editor now resizes `.widget-container` (removed `!important`), mode classes apply on `DOMContentLoaded` (~60ms) fixing the brief wrong-layout flash on reload, and overrides sync to the dev server via `POST /__edits`.
