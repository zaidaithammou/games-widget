# Games Widget

Games Widget is a lightweight Windows desktop companion for organizing and launching installed PC games. It runs as a movable, resizable, always-on-top Electron widget and can stay minimized as a compact desktop icon.

## Features

- **Scan installed games** from Steam, Epic Games, GOG Galaxy, Xbox / Microsoft Store, Battle.net, Ubisoft Connect, and the EA App, then choose which detected games to add. Games installed outside a launcher can be added manually by selecting their executable.
- **Recently Played** sorts the library by the games you last launched, shows when each was played, and adds a Recently Played folder to the group view. Steam play history is imported from Steam's app manifests.
- **Disk View** presents game artwork in circular disc cards.
- **Icon / Wallpaper View** displays fitted landscape artwork in each game card.
- **Artwork lookup** searches available Steam and Epic Games Store sources, with a backup provider for titles that are missing artwork.
- **Custom game artwork** lets you choose a local image for an individual game. The image is copied into the app's user data so it remains available after restart.
- **Game editing** lets you change a game's displayed name and custom wallpaper while retaining its original launcher identity for artwork and launching.
- **Game launching** supports Steam links, Epic Games Launcher links, Xbox app entries, Ubisoft Connect links, Battle.net, and installed executable paths when available.
- **Performance mode** turns the widget into a small always-on-top overlay showing FPS, frame time, CPU and GPU temperature and load, and RAM usage. CPU load and RAM are always available; temperatures and GPU load come from MSI Afterburner, LibreHardwareMonitor, or Windows GPU counters. FPS comes from RivaTuner Statistics Server (RTSS) - the widget automatically starts RTSS if it's installed but not running. The performance overlay includes minimize and exit buttons and uses the same visual style as the main widget.
- **Launcher folders and custom groups** organize games by launcher (Steam, Epic Games, GOG, Xbox, Battle.net, Ubisoft Connect, EA App, Manual) or groups you create. Right-click a game to move it to a custom group; choose **Sort by Group** to browse folder-style groups.
- **Persistent library and settings** restore saved games, user groups, artwork choices, and widget placement after restart.
- **Widget controls** include drag-to-move, resize limits, minimize-to-compact-icon, restore, always-on-top behavior that works over fullscreen apps, and a system tray menu.
- **Windows app icon** uses the custom Games Widget artwork in the app and tray.

## Requirements

- Windows 10 or Windows 11
- Node.js LTS and npm (for running from source or building)
- Internet access for online artwork lookup

## Run from source

Open PowerShell in the project directory and run:

```powershell
npm install
npm start
```

For development mode with the app's developer tools enabled:

```powershell
npm run dev
```

## Build for Windows

Create the Windows installer:

```powershell
npm run build
```

Create a portable x64 executable that can be run directly:

```powershell
npm run build:portable
```

Build artifacts are written to `build/`. Each versioned executable is kept in `build/versions/<version>/`; these generated files remain excluded from Git. The `versions/` directory contains the recovered app source and change notes for each iteration. Publish the matching executable as a GitHub Release asset rather than committing large binaries to the source repository.

## Track each iteration on GitHub

Use Git commits to record the **source-code changes** for every iteration. Before publishing, fill in that iteration's `versions/<version>/CHANGELOG.md` with the features added, changed, or removed. Use a version tag and a GitHub Release to publish that iteration's **downloadable Windows build**. A release should point to the commit that produced its executable.

### Publish the recovered versions in order

[`publish-history.sh`](publish-history.sh) publishes the reconstructed history one version at a time: it advances `main`, pushes the matching version tag, and creates a GitHub Release with that version's executable and changelog. The first missing release publishes immediately; each following release starts after a five-minute wait. With 14 versions and no existing releases, the sequence takes about 65 minutes plus upload time. The final repository-documentation commit is pushed after the last release.

Install **Git for Windows** and **GitHub CLI**, authenticate in Git Bash with `gh auth login`, then open Git Bash in the project folder and run:

```bash
./publish-history.sh "https://github.com/<YOUR-USERNAME>/<REPOSITORY>"
```

The repository link is the only required argument. The script checks the clean `main` branch, every tag/snapshot/executable, and remote history; it resumes if the remote is a chronological prefix of this same release sequence. Preview the plan first:

```bash
./publish-history.sh "https://github.com/<YOUR-USERNAME>/<REPOSITORY>" --dry-run
```

Keep the computer and network available while it runs. GitHub authentication and permission to push/create releases are required. The script publishes the existing commits as authored; Git Bash does not change commit attribution.

For each new iteration, after making and reviewing the source changes:

```powershell
git add -A
git diff --cached --check
git commit -m "feat: describe the iteration"
git push origin main
```

After building the app and updating its version in `package.json`, tag that commit and push the tag. For example, from PowerShell:

```powershell
git tag -a v1.1.4 -m "Games Widget 1.1.4"
git push origin v1.1.4
gh release create v1.1.4 "build/versions/1.1.4/Games Widget 1.1.4.exe" --title "Games Widget 1.1.4" --notes-file "versions/1.1.4/CHANGELOG.md"
```

Replace the example version with the new version, create its `versions/<version>/CHANGELOG.md`, and put its built executable in `build/versions/<version>/`. Install GitHub CLI (`gh`) and authenticate with `gh auth login` to use the release command. You can also create a release on GitHub's **Releases** page, select the matching tag, and upload the `.exe` from its version folder there.

Keep `build/` out of ordinary Git commits. GitHub Releases are the right place for the large `.exe` files; the repository history should contain the source, documentation, and assets needed to build them.

## Use the widget

1. Select **Scan Games**, choose the launchers to scan, and add the games you want in the library.
2. Use the view selector to switch between **Disks** and **Icons** (fitted wallpaper artwork).
3. Open **Settings** to create custom groups. Right-click a game and choose **Move to Group…** to assign it. Select **Sort by Group** to see the launcher and custom folders.
4. Right-click a game and choose **Edit** to change its displayed name or select a custom wallpaper. Choose **Save** to keep the changes.
5. Choose **Recently Played** in the sort selector to see the games you launched most recently.
6. Start a game with its **Play** button or the right-click **Launch** command.
7. Select the gauge button next to minimize to open performance mode; hover the overlay to reveal minimize (−) and exit (×) buttons. Minimize collapses to the compact icon; exit returns to the game library.
8. Drag the top bar to reposition the widget and drag its edges to resize it. Minimize leaves a small movable icon; click the icon to restore the widget.
9. Use the system tray menu to show the widget, open settings, hide it, or quit. `Ctrl+Alt+G` toggles widget visibility.

## Project structure

```text
Games Widget/
├── assets/                 # Runtime tray icon and Windows application icon
├── build/                  # Generated installers and executables (ignored by Git)
├── img/                    # Original supplied artwork assets
├── legacy/
│   ├── main.js              # Earliest standalone Electron entry point
│   ├── simple.html          # Minimal Electron smoke-test page
│   ├── test.js              # Minimal Electron smoke-test entry point
│   └── web-widget.html      # Earlier standalone web prototype
├── versions/                # Recovered source snapshots and changelogs per version
├── node_modules/           # Installed npm dependencies (ignored by Git)
├── src/
│   ├── main.js              # Electron window, game scanning/launching, persistence, native dialogs
│   ├── performance-monitor.js # CPU, GPU, RAM, temperature, and FPS sampling for performance mode
│   ├── preload.js           # Limited and explicit renderer IPC API
│   ├── index.html           # Widget and settings markup
│   ├── renderer.js          # Library, groups, artwork, and interaction logic
│   └── styles.css           # Widget styling and layout
├── .gitignore
├── package.json
├── package-lock.json
└── README.md
```

The Electron app stores the library, user groups, settings, and imported wallpapers under Electron's per-user `app.getPath('userData')` directory. These local files are not part of the Git repository.

The [`versions/`](versions/README.md) directory contains the packaged app source recovered from each available build, with a changelog describing the differences. The release-by-release Git history is reconstructed from those installers and the available development notes; it is not the original commit history. The snapshots are for review, and the current working source remains under `src/`.

## Technology

- Electron 32
- Node.js
- HTML, CSS, and vanilla JavaScript
- Electron IPC with context isolation for renderer-to-main-process operations
- `electron-builder` for Windows installer and portable builds

## Development notes

- `npm start` launches the Windows desktop app from source.
- `npm run build` produces the installer configured in `package.json`.
- `npm run build:portable` creates the portable x64 Windows build.
- `npm test` opens the minimal Electron smoke-test window from `legacy/`; it is not an automated test suite for the game library.
- Artwork providers and launcher installation records can change independently of the widget code. Keep provider failures graceful so the library remains usable when a lookup source is unavailable.

## License
This project is open-source and available under the [MIT License](LICENSE).

---
<div align="center">
  <p><b>Zaid Ait Hammou</b> (Zaid_Ath)</p>
  <p>Full-Stack Web Development Student @ NTIC Rabat | Ex-Bell & Nespresso Specialist</p>
  <p>
    <a href="https://zaidath-portfolio.netlify.app/">🌐 Portfolio</a> •
    <a href="https://github.com/zaidaithammou">📦 GitHub</a>
  </p>
</div>
