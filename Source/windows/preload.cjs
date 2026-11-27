'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('glassDeck', Object.freeze({
  openDisplay: () => ipcRenderer.invoke('open-display'),
}));
