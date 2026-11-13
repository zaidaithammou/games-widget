# Games Widget 2.3.2

- **Locked ring columns**: CPU/GPU/RAM rows in Performance Mode are now a fixed 5-column CSS grid (label → ring → value → ring → value), so both circular gauges sit at identical X positions across all three rows in every theme.
- **Hardware label icons (horizontal overlay)**: The minimized horizontal performance bar replaces the CPU/GPU/RAM text labels with clean vector icons — processor chip, GPU fan module, and memory stick — shown only in horizontal mode; the FPS label text is preserved.
- **Right-aligned secondary readouts**: The second metric cluster (load percentage) in each row now hugs the right edge of its container in both performance views, while ring X-positions stay locked.
- **Bolder horizontal readouts**: Temperature, memory, and percentage values in the horizontal view are slightly larger (13px values / 10px units) for better legibility.
- **Lowered sparkline**: The FPS waveform graph in the horizontal view sits lower in its cell (increased top margin), creating cleaner separation from the FPS/ms header.
- **Cover art flip toggle**: The Icons/Disks `<select>` dropdown is replaced by a single sleek toggle button showing the active mode's vector icon (grid or disc) with a smooth flip animation, tooltip, and accent hover styling.

**Compared with:** [2.3.1](../2.3.1/CHANGELOG.md). Patch focused on performance-grid alignment, overlay iconography, and the cover-art switcher UX.
