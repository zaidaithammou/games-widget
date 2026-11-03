# Games Widget

A Windows desktop overlay for displaying and managing your game library. It runs as a small frameless Electron window with a system tray icon, so it can stay open while you use other apps.

## Features

- **Persistent Desktop Widget**: Frameless, always-on-top window with no taskbar button
- **System Tray Controls**: Show, hide, open settings, or quit from the tray menu; `Ctrl+Alt+G` toggles visibility
- **Installed Game Scanning**: Read installed game records from Steam, Epic Games, and GOG
- **Automatic Cover Art**: Try Steam, then Epic Games Store and EGDATA artwork; fill missing covers in the existing library
- **Executable Icons**: Use each installed game's own Windows executable icon for the Icons and Disks views when available
- **Quick Removal**: Remove games from the library with the button on each game card or its right-click menu
- **Saved Library**: Keep the game list in the app's local data file and restore it whenever the widget opens
- **Game Launching**: Start a game with the Play button on its card
- **Drag & Drop Relocation**: Drag the header to move the widget; its position and size are saved
- **Compact Mode**: The minimize button leaves a small movable app icon on screen; click it to expand the widget
- **Resize Functionality**: Customize the widget size when open
- **Multiple Cover Art Styles**: Choose centered game icons, discs, or full-fit wallpapers
- **Sorting Options**: Sort games by name, category, or user-created groups
- **User Groups**: Create custom groups to organize your games
- **Modern UI**: Beautiful gradient design with smooth animations

## Installation

1. **Install Node.js**: Make sure Node.js is installed and added to your PATH
   - Download from: https://nodejs.org/
   - Install the LTS version

2. **Install Dependencies**:
   ```bash
   npm install
   ```

## Running the Widget

**Development Mode**:
```bash
npm run dev
```

**Production Mode**:
```bash
npm start
```

## Building for Distribution

```bash
npm run build
```

This creates a Windows installer in the project `build` folder. To create a standalone portable application that you can double-click without installing, run:

```bash
npm run build:portable
```

The portable `.exe` is written to `build`.

## Usage

### Basic Controls

- **System Tray**: Right-click the tray icon to show/hide the widget or access settings
- **Drag**: Click and drag the widget header to move it around your desktop
- **Resize**: Drag the edges/corners to resize the widget
- **Close Button**: Hides the widget (doesn't quit the application)

### Adding Games

1. Click the "🎮 Scan Games" button
2. Select which platforms to scan (Steam, Epic Games, GOG)
3. Click "Start Scan"
4. Select the games you want to add from the results
5. Click "Add Selected"

When adding a detected game, the widget tries an exact Steam Store title match, then an Epic Games Store catalog match, then EGDATA. This gives Epic-only titles such as Fortnite additional artwork sources. It also tries to fill missing covers for games already in the library. Names must match so it does not silently assign artwork for a different game.

### Customizing Appearance

1. Click the "⚙️ Settings" button
2. Choose your preferred cover art style (Icons, Disks, or Wallpaper)
3. Create custom groups to organize your games
4. Click "Save" to apply changes

### Sorting Games

Use the dropdown menu to sort games by:
- **Name**: Alphabetical order
- **Category**: Game genre
- **Group**: User-created groups

### Managing Games

- **Launch**: Click on a game card to launch it
- **Edit**: Right-click a game and select "Edit" to rename it
- **Remove**: Right-click a game and select "Remove" to delete it from your library

## Project Structure

```
games-widget/
├── assets/
│   ├── icon.png          # System tray icon
│   └── icon.ico          # Windows application icon
├── src/
│   ├── main.js           # Electron window and tray
│   ├── preload.js        # Limited renderer-to-window controls
│   ├── index.html        # HTML structure
│   ├── styles.css        # CSS styling
│   └── renderer.js       # Frontend logic
├── package.json          # Project configuration
└── README.md            # This file
```

## Technology Stack

- **Electron**: Windows desktop window and system tray
- **Vanilla JavaScript**: Lightweight and fast
- **CSS3**: Modern styling with gradients and animations
- **localStorage**: For persisting the game library and appearance settings

## Future Enhancements

- Launching installed games from their detected install paths
- Broader artwork sources for games that are not listed on Steam
- Game launching with actual executable paths
- Cloud sync for game library across devices
- Custom themes and color schemes
- Game statistics and play time tracking

## License

MIT

## Contributing

Feel free to submit issues and enhancement requests!
