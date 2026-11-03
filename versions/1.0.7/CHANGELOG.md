# Games Widget 1.0.7

- Added a Play action to each game card, with launching through the game's launcher or executable when available.
- Persisted the game library in the app's user-data directory and migrated existing browser-stored entries.
- Separated game cover artwork from executable icons so the artwork view uses cover images while the disc view can use app icons.
- Moved Play and Remove actions below the game's details.

**Compared with:** [1.0.6](../1.0.6/CHANGELOG.md). The recovered renderer and IPC bridge add library persistence and game-launch actions.
