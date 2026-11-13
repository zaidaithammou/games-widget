# Games Widget 2.3.3

- **Narrower performance window**: The normal (vertical) performance window width reduced from 260px to 240px for a tighter footprint; the fixed 5-column metric grid keeps ring/value alignment intact and the `%` symbols remain unclipped.
- **Compact horizontal metric cards**: The horizontal performance stats grid now sizes CPU/GPU/RAM cards to `max-content` so each card hugs its icon, gauges, and values — numbers sit adjacent to their rings with no dead space, and percentages are no longer pushed to the card edge.
- **FPS card refinements (horizontal)**: The FPS card is now a flex column — the `-- ms` readout is pinned to the top-right corner, and the sparkline is pushed to the bottom of the card for cleaner separation from the counters.
- **Larger hardware icons**: CPU/GPU/RAM label icons in the horizontal view enlarged from 14px to 18px for better visibility.
- **Recalculated overlay width**: `PERFORMANCE_HORIZONTAL_WINDOW_WIDTH` reduced from 760px to 680px to match the tightened cards, FPS cell, and control column with no trailing empty space.
- **Icon-only cover art switch**: The Icons/Disks toggle is now a compact 40×40 icon button (no text label) that keeps the flip animation and dynamic tooltip.
- **Modernized game-folder chevrons**: Folder expand indicators now use the same SVG caret + rotate-on-open treatment as the settings accordions.
- **Accordion spacing**: Open settings sections get 10px of top padding for breathing room below the section header.
- **Panel positioning fix**: `.widget-container` is now `position: relative` so absolutely-positioned panels (settings, scanner, edit) are correctly contained within the widget bounds.
- **Vertical perf refinements**: The `-- ms` readout is pinned to the top-right of the FPS card in the normal view too; metric rows rebalance to 1.1fr/0.9fr columns so percentages sit close to their rings while the last readout still reaches the card edge; the stats column now distributes cards evenly to eliminate the dead space below the RAM row.
- **Settings footer**: The Save/Close action row is moved out of the scrollable settings content and pinned to the bottom of the panel; both buttons share a uniform minimum width, and Close gets a red hover state.
- **Uniform horizontal metric cards**: CPU/GPU/RAM cards in the horizontal overlay now share equal-width grid tracks so all three containers render at the same size; overlay width recalculated to 680px.
- **Larger horizontal hardware icons**: CPU/GPU/RAM icons enlarged to 20px with a wider label column.
- **Vertical perf rows reworked**: Rows switched to a flex layout with evenly distributed spacing — label on the left, each ring+value pair kept glued together and spread across the card width.
- **Ultra-compact horizontal overlay**: Target width reduced to ~490px with a fully compact density pass — smaller icons (14px), rings (10px), values (10px), units (8px), tighter gaps/padding — while the FPS card gets a wider 1.3fr share so it stays readable.

**Compared with:** [2.3.2](../2.3.2/CHANGELOG.md). Patch focused on window dimension tightening and dead-space removal in both performance views.
