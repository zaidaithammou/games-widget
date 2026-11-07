# Games Widget 2.0.2

- **RTSS discovery and launch rework**: RTSS.exe is now located through common install paths, Windows uninstall registry entries, `where.exe`, and PowerShell command lookup before launching. Startup keeps verifying for up to ~30 seconds so delayed UAC/elevation approval can still bring telemetry online.
- **Telemetry status clarity**: RTSS status now reports starting/waiting/offline states and rechecks the process list before declaring failure, reducing false "RTSS did not start" reports.
- **Performance Mode sizing**: Vertical performance height reduced from the oversized 2.0.1 footprint to a tighter `260 × 304` clean / `260 × 344` with dependency links while keeping all cards visible.
- **FPS consistency**: Verified both vertical and horizontal Performance Mode render the same live FPS sample and history; only presentation differs.

**Compared with:** [2.0.1](../2.0.1/CHANGELOG.md). Focused patch for RTSS launch reliability and performance-window sizing.
