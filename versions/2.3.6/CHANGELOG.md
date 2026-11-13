# Changelog — v2.3.6

## Performance overlay alignment pass + library polish

- **Horizontal performance bar**: all four cards (FPS, CPU, GPU, RAM) now share identical height — removed the fixed `40px` card height that made the FPS container taller than the metric cards.
- **Control gutter**: slimmed the button column (`26px → 20px`, gap `3px → 2px`) so `≡`/`−`/`×` sit closer to the FPS container; window width adjusted `495 → 492px` to keep the FPS card unchanged.
- **Metric alignment**: removed per-row translate nudges that shifted CPU/GPU/RAM readouts unevenly; all three rows now use identical column tracks so rings and numbers line up vertically across cards.
- **Vertical performance window**: rows restructured to a 7-track grid — first ring/value pair centers in the free space, second pair pins to the right edge, with fixed tracks keeping positions stable across digit counts. Container and window sizes unchanged.
- **FPS card (vertical)**: value pulled 13px toward the FPS label and the graph nudged per user layout-editor overrides; label-to-value gap tightened to match the extended view.
- **Library sort dropdown**: native arrow replaced with the settings accordion's chevron style for a consistent modern look.
- **Dev tooling**: layout-editor override state excluded from version control via `.gitignore`.
