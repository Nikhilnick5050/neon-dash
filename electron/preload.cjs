// Runs in a sandbox. Exposes only a tiny, safe API to the game page.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('neonDash', {
  isDesktop: true,
  loadSave: () => ipcRenderer.invoke('save:load'),
  writeSave: (text) => ipcRenderer.invoke('save:write', String(text)),
  quit: () => ipcRenderer.invoke('app:quit'),
});
