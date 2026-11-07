# Games Widget 2.0.1

- **RTSS startup reliability**: Added a PowerShell process-list fallback after `tasklist`, rechecks whether RTSS is already running before reporting spawn failures, and keeps telemetry status messaging clearly online/offline without crashing the main process.
- **Vertical Performance Mode fit**: Increased the default vertical overlay height so the FPS, CPU, GPU, and RAM cards render fully without bottom clipping; dependency-link height was adjusted to match.
- **Horizontal control polish**: Standardized the horizontal mode toggle/minimize/close cluster to identical 18px buttons with centered icons and even spacing.
- **Library padding cleanup**: Reduced top window/header padding and bottom game-grid padding to remove excess dead space in the main library view.

**Compared with:** [2.0.0](../2.0.0/CHANGELOG.md). Patch release focused on RTSS reliability, Performance Mode clipping/alignment, and main-window spacing.
