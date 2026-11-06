# Games Widget 1.2.0

- Added a **Recently Played** option to the sort selector. Launching a game records when it was played, cards show how long ago it was played, and the group view gains a Recently Played folder.
- Imported Steam's last-played times from its app manifests so existing Steam games appear in Recently Played.
- Added a performance button next to minimize and close. Performance mode shrinks the widget into an always-on-top overlay with FPS and frame time, CPU temperature and load, GPU temperature and load, and RAM usage.
- Read temperatures and GPU load from MSI Afterburner, LibreHardwareMonitor, or Windows GPU counters, and FPS from RivaTuner Statistics Server, with a hint shown when a source is not running.
- **Fixed FPS monitoring**: RTSS shared memory signature now accepts both RTSS and RTSR versions, and time comparison no longer fails due to different time sources.
- **Auto-start RTSS**: The widget automatically launches RivaTuner Statistics Server if it's installed but not running when performance mode is activated.
- **Fixed widget visibility**: The widget now stays on top over fullscreen applications using the highest always-on-top level and workspace visibility settings.
- Added a **minimize button** to performance mode that collapses to the compact icon.
- Updated performance mode styling to match the main widget's gradient palette.
- Added scanning for Xbox / Microsoft Store, Battle.net, Ubisoft Connect, and EA App games, with launcher-specific launching for Xbox, Ubisoft Connect, and Battle.net.
- Added **Manually installed games** to the scanner so any game executable can be added to the library.
- Added launcher folders for the new platforms in the group view.

**Compared with:** [1.1.3](../1.1.3/CHANGELOG.md). Adds `src/performance-monitor.js` and the performance, recently played, and new scanner IPC in main/preload/renderer.
