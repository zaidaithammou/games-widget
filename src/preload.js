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
  fetchArtworkData: (url) => ipcRenderer.invoke('games:fetch-artwork-data', url),
  saveEnhancedArtwork: (gameId, dataUrl) => ipcRenderer.invoke('games:save-enhanced-artwork', gameId, dataUrl),
  launchGame: (game) => ipcRenderer.invoke('games:launch', game),
  getExecutableIcon: (executablePath, installPath, gameName) => ipcRenderer.invoke('games:executable-icon', executablePath, installPath, gameName),
  findBackupArtwork: (query) => ipcRenderer.invoke('games:backup-artwork', query),
  onCompactState: (callback) => ipcRenderer.on('widget:compact-state', (_event, compact) => callback(compact)),
  onOpenSettings: (callback) => ipcRenderer.on('open-settings', callback)
});
