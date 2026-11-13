# Games Widget 2.3.1

- **Performance row distribution**: CPU, GPU, and RAM rows in both performance views now use `justify-content: space-between` with non-stretching metric clusters, so labels, rings, temperatures, and percentages spread cleanly across the full card width with no dead space on the right.
- **FPS/MS counter alignment**: `.perf-fps-top` switched from baseline to top alignment, lifting the FPS value and frame-time readout toward the upper corners of their container in both vertical and horizontal performance modes.
- **Horizontal spacing pass**: Performance-row gaps increased (12px vertical / 8px horizontal) for a roomier, better-proportioned overlay.
- **Modern accordion chevrons**: Settings dropdown indicators replaced the text triangle with a crisp 15px SVG chevron — accent-tinted at rest, accent-colored when expanded, with a soft hover background and smooth 180° rotation.

**Compared with:** [2.3.0](../2.3.0/CHANGELOG.md). Patch focused on performance-overlay spacing polish and settings dropdown icon modernization.
