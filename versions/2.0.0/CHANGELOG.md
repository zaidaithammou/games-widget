# Games Widget 2.0.0

- **Ultra-slim horizontal Performance Mode**: Rebuilt the horizontal overlay as a compact grid with a narrow left control stack. The mode toggle now sits above minimize/close, all metric labels/frames/dependency buttons are removed in horizontal mode, and the window height is reduced to a slim strip.
- **Smart dependency injection**: Performance Mode now probes for RTSS and MSI Afterburner in the background. The dependency footer only appears in vertical mode when at least one tool is missing, and it shows only the missing tool's download button. When both are installed, the footer and its window space collapse completely.
- **RTSS launch stability**: Wrapped external process launches in guarded spawn handling with error/exit listeners. RTSS startup now handles `EACCES`/missing-binary failures without crashing the main process, can request elevation once when needed, and reports a non-blocking status line in Performance Mode.
- **Header modernization**: Moved Settings into the top window chrome next to the window controls and left Scan Games as the primary action on the right side of the game-library header.
- **Compact game cards**: Reduced card padding, cover spacing, text spacing, and action-strip height across icon and disc layouts; disc covers are sized smaller so cards stay tighter.
- **In-card actions**: Removed the right-click context menu and added permanent per-card controls for Play, Edit, Move to Group, and Remove in both icon and disc views.

**Compared with:** [1.2.3](../1.2.3/CHANGELOG.md). This is the v2.0.0 UI/UX and stability refactor.
