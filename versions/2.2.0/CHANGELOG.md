# Games Widget 2.2.0

- **Compact performance controls**: Buttons inside the vertical Performance Mode window are 24×24px rounded squares (7px radius, 14px icons, 13px glyphs); the horizontal overlay uses even smaller 20px circles (12px icons/glyphs); the main toolbar keeps its 28×28px buttons.
- **Ultra-slim horizontal overlay**: `PERFORMANCE_HORIZONTAL_WINDOW_HEIGHT` reduced to 76px — the circular buttons and 4px gaps let the left control column take minimal vertical space while keeping the same configuration.
- **Tight, uniform spacing**: All performance-panel buttons share a consistent 4px gap — including between minimize and exit in the vertical view and across the whole left column in the horizontal view, which reads as one container.
- **Fixed horizontal button sizing**: `align-items: center` plus locked `aspect-ratio`, min/max, and `flex: none` constraints keep every horizontal button a perfect 20px circle — no column-width stretching or oval distortion on the layout toggle.
- **Expanded hit areas**: Each control button keeps an invisible `::after` zone so hover colors and clicks stay reliable even on the compact circles.
- **Hover-only color rules preserved**: Neutral gray at rest; red (close), yellow (compact/minimize), green (layout toggle), vibrant blue (performance), and indigo `#6366F1` (settings) on hover.

**Compared with:** [2.1.1](../2.1.1/CHANGELOG.md). Focused on compact performance controls, overlay-density spacing, and reliable hit-testing across all widget views.
