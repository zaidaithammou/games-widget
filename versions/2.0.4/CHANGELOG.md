# Games Widget 2.0.4

- **Dynamic Performance Mode height**: The vertical performance window now sizes to the actual visible content instead of reserving unused bottom space.
- **Conditional dependency footer**: The dependency notice and RTSS/Afterburner buttons are fully collapsed when both tools are installed, and the window expands only when a required dependency is missing.
- **Telemetry status spacing**: The non-blocking RTSS status line now has its own small dynamic height allowance, so status messages do not clip metrics or leave permanent empty space.
- **Compact clean state**: With dependencies satisfied and no status message, Performance Mode uses a tighter `260 × 260` footprint; dependency links expand it to `260 × 304` only when needed.

**Compared with:** [2.0.3](../2.0.3/CHANGELOG.md). Focused on removing dead space and making Performance Mode height fully content-driven.
