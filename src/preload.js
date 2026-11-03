const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gamesWidget', {
  minimize: () => ipcRenderer.send('widget:minimize'),
  close: () => ipcRenderer.send('widget:close'),
  beginDrag: () => ipcRenderer.send('widget:drag-start'),
  endDrag: () => ipcRenderer.send('widget:drag-end'),
  scanInstalledGames: (platforms) => ipcRenderer.invoke('games:scan', platforms),
  findArtwork: (query, appId) => ipcRenderer.invoke('games:artwork', query, appId),
  loadGames: () => ipcRenderer.invoke('games:load'),
  saveGames: (games) => ipcRenderer.send('games:save', games),
  loadUserGroups: () => ipcRenderer.invoke('groups:load'),
  saveUserGroups: (groups) => ipcRenderer.send('groups:save', groups),
  launchGame: (game) => ipcRenderer.invoke('games:launch', game),
  chooseGameWallpaper: (gameId) => ipcRenderer.invoke('games:choose-wallpaper', gameId),
  getExecutableIcon: (executablePath, installPath, gameName) => ipcRenderer.invoke('games:executable-icon', executablePath, installPath, gameName),
  findBackupArtwork: (query) => ipcRenderer.invoke('games:backup-artwork', query),
  onCompactState: (callback) => ipcRenderer.on('widget:compact-state', (_event, compact) => callback(compact)),
  onOpenSettings: (callback) => ipcRenderer.on('open-settings', callback)
});
