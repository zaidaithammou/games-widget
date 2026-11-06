# Games Widget 1.2.1

- **Fixed FPS monitoring**: RTSS shared memory signature now accepts both RTSS (0x53535452) and RTSR (0x52545353) versions, and the staleness check no longer fails because RTSS uses a different time source than `Environment.TickCount`.
- **Auto-start RTSS**: When performance mode is activated, the widget automatically launches RivaTuner Statistics Server if it is installed but not running (checks common install paths).
- **Fixed widget visibility over fullscreen apps**: The widget now uses the highest always-on-top level (`screen-saver`) with `setVisibleOnAllWorkspaces` and `visibleOnFullScreen`, plus blur/focus handlers that keep it on top and prevent unwanted minimization.
- **Minimize button in performance mode**: The performance overlay now has a minimize (−) button that collapses to the compact icon, alongside the existing exit (×) button that returns to the game library.
- **Performance mode styling**: The overlay now uses the same gradient palette, border, and shadow as the main widget.
- **RAM percentage display**: The RAM row now shows both gigabytes used and percentage of total RAM, each with its own progress ring (matching CPU/GPU rows).
- **Download links for monitoring tools**: When FPS or temperatures are unavailable, a "Get FPS & temps" bar appears in performance mode with buttons that open the RTSS and MSI Afterburner download pages. Links open only over HTTPS and hide automatically once all data sources are available.

**Compared with:** [1.2.0](../1.2.0/CHANGELOG.md). Fixes FPS data ingestion from newer RTSS builds, keeps the widget visible over fullscreen applications, adds performance-mode minimize, RAM percentage, and in-app download links for monitoring tools.
