const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('rn', {
  version: '0.1.0',
  journalLogin: (url) => ipcRenderer.invoke('journal:login', url),
  journalScan: (url) => ipcRenderer.invoke('journal:scan', url)
});
