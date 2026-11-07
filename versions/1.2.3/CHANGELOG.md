# Games Widget 1.2.3

- **Fixed Performance Mode dependency links**: The overlay now keeps the taller layout when RTSS or MSI Afterburner download links are shown instead of snapping back to the clean-state height and hiding the buttons.
- **Cleaner Performance Mode footer**: Removed the small source/status line and tightened the space below the dependency buttons.
- **Larger dependency buttons**: RTSS and MSI Afterburner links are bigger and easier to click when monitoring tools are missing.
- **Horizontal Performance Mode layout**: Added a hamburger-style button at the top-left of Performance Mode to switch the FPS, CPU, GPU, and RAM cards between vertical and horizontal arrangements. The horizontal view is now a slim single-row strip with the dependency label hidden.
- **Dependency install detection**: The performance sampler now checks whether RTSS and MSI Afterburner are installed. Detected tools show an installed/active state on their buttons; missing tools remain clickable download links.

**Compared with:** [1.2.2](../1.2.2/CHANGELOG.md). Fixes Performance Mode sizing for missing monitoring dependencies, cleans up the dependency-link footer, adds a vertical/horizontal layout toggle, and detects installed monitoring tools.
