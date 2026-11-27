'use strict';

const path = require('node:path');
const { app, BrowserWindow, ipcMain, screen, dialog } = require('electron');
const { createHost } = require('../server.cjs');

app.setName('GlassDeck');
app.setAppUserModelId('com.glassdeck.editor');

let host;
let editor;
let display;
let quitting = false;
const webPreferences = {
  preload: path.join(__dirname, 'preload.cjs'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
};

function ownWindow(options) {
  const window = new BrowserWindow({
    title: 'GlassDeck',
    backgroundColor: '#0c111d',
    autoHideMenuBar: true,
    show: false,
    ...options,
    webPreferences,
  });
  const origin = new URL(host.editorUrl).origin;
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, reply) => reply(false));
  const restrictNavigation = (event, details) => {
    const target = (typeof details === 'string' ? details : details?.url) || event.url;
    if (!target || new URL(target).origin !== origin) event.preventDefault();
  };
  window.webContents.on('will-navigate', restrictNavigation);
  window.webContents.on('will-frame-navigate', restrictNavigation);
  window.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      event.preventDefault();
      window.setFullScreen(!window.isFullScreen());
    } else if (input.type === 'keyDown' && input.key === 'Escape' && window.isFullScreen()) {
      event.preventDefault();
      window.setFullScreen(false);
    }
  });
  window.once('ready-to-show', () => window.show());
  return window;
}

async function showEditor() {
  editor = ownWindow({ width: 1480, height: 960, minWidth: 780, minHeight: 570 });
  editor.on('closed', () => {
    editor = null;
    if (display && !display.isDestroyed()) display.close();
  });
  await editor.loadURL(host.editorUrl + '/editor');
}

async function showDisplay() {
  if (display && !display.isDestroyed()) { display.focus(); return; }
  const editorScreen = screen.getDisplayMatching(editor.getBounds());
  const second = screen.getAllDisplays().find(item => item.id !== editorScreen.id);
  display = ownWindow({
    title: 'GlassDeck Display',
    ...(second ? { ...second.bounds, fullscreen: true } : { width: 1280, height: 800 }),
  });
  display.on('closed', () => { display = null; });
  await display.loadURL(host.editorUrl + '/display');
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => {
    if (!editor || editor.isDestroyed()) return;
    if (editor.isMinimized()) editor.restore();
    editor.focus();
  });
  app.whenReady().then(async () => {
    host = await createHost({ dataDir: app.getPath('userData') });
    ipcMain.handle('open-display', event => {
      if (editor && event.sender === editor.webContents) return showDisplay();
    });
    await showEditor();
  }).catch(error => {
    dialog.showErrorBox('GlassDeck could not start', error.message);
    app.quit();
  });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', event => {
    if (!host || quitting) return;
    event.preventDefault();
    quitting = true;
    host.close().finally(() => app.quit());
  });
}
