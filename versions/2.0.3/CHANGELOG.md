# Games Widget 2.0.3

- **Automatic telemetry launch**: Entering Performance Mode now attempts to launch both RTSS and MSI Afterburner automatically when installed, using shell-execute first with guarded spawn/elevation fallbacks.
- **RTSS reliability**: RTSS discovery still uses common paths, uninstall registry entries, `where.exe`, and PowerShell lookup; startup verification keeps checking the process list so delayed UAC/elevation approval can recover telemetry.
- **MSI Afterburner launch**: Added equivalent install detection and background launch handling for `MSIAfterburner.exe`, including registry/PATH discovery and one elevation retry on `EACCES`.
- **Performance counter parity**: Horizontal Performance Mode now keeps compact FPS/CPU/GPU/RAM labels and frame-time text so the secondary bar matches the main performance presentation while staying slim.
- **Panel corners**: Settings/scanner panels now keep rounded corners and clipping even when their content is taller than the main window.

**Compared with:** [2.0.2](../2.0.2/CHANGELOG.md). Focused on automatic telemetry startup and UI consistency fixes.
