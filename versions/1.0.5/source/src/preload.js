const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gamesWidget', {
  minimize: () => ipcRenderer.send('widget:minimize'),
  close: () => ipcRenderer.send('widget:close'),
  beginDrag: () => ipcRenderer.send('widget:drag-start'),
  endDrag: () => ipcRenderer.send('widget:drag-end'),
  scanInstalledGames: (platforms) => ipcRenderer.invoke('games:scan', platforms),
  findArtwork: (query, appId) => ipcRenderer.invoke('games:artwork', query, appId),
  getExecutableIcon: (executablePath) => ipcRenderer.invoke('games:executable-icon', executablePath),
  findBackupArtwork: (query) => ipcRenderer.invoke('games:backup-artwork', query),
  onCompactState: (callback) => ipcRenderer.on('widget:compact-state', (_event, compact) => callback(compact)),
  onOpenSettings: (callback) => ipcRenderer.on('open-settings', callback)
});
