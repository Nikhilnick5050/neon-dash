// Electron main process: one secure window that only loads the bundled game.
const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('node:path');
const { readSave, writeSave } = require('./save-file.cjs');

const isDev = !app.isPackaged && process.env.NEON_DASH_DEV === '1';
const indexFile = path.join(__dirname, '..', 'dist', 'index.html');
const indexUrl = require('node:url').pathToFileURL(indexFile).href;

// Only one copy of the game at a time.
if (!app.requestSingleInstanceLock()) app.quit();

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 960,
    minHeight: 540,
    title: 'Neon Dash',
    backgroundColor: '#05030d',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      spellcheck: false,
      backgroundThrottling: true,
    },
  });

  Menu.setApplicationMenu(null);
  win.once('ready-to-show', () => win.show());
  win.loadFile(indexFile);

  // No remote content: block navigation and new windows completely.
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.on('will-redirect', (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.session.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  win.webContents.session.webRequest.onBeforeRequest((details, cb) => {
    const ok = details.url.startsWith('file://') || details.url.startsWith('devtools://') ||
      details.url.startsWith('data:') || details.url.startsWith('blob:');
    cb({ cancel: !ok });
  });

  // F11 toggles fullscreen.
  win.webContents.on('before-input-event', (_e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') win.setFullScreen(!win.isFullScreen());
  });

  if (isDev) win.webContents.openDevTools({ mode: 'detach' });
  win.on('closed', () => { win = null; });
  if (process.env.NEON_DASH_SMOKE === '1') runSmokeTest(win);
}

// `npm run smoke`: start the real app, check the security settings and the save
// bridge from inside the page, print the result and quit.
function runSmokeTest(w) {
  w.webContents.once('did-finish-load', async () => {
    await new Promise((r) => setTimeout(r, 1500));
    const result = await w.webContents.executeJavaScript(`(async () => {
      const before = await window.neonDash.loadSave();
      const ok = await window.neonDash.writeSave(JSON.stringify({ best: 777, settings: { quality: 'low' } }));
      const after = JSON.parse(await window.neonDash.loadSave());
      let remote = 'blocked';
      try { await fetch('https://example.com', { mode: 'no-cors' }); remote = 'ALLOWED'; } catch { }
      return {
        title: document.title,
        menuVisible: !document.getElementById('menu').classList.contains('hidden'),
        nodeRequire: typeof require, nodeProcess: typeof process,
        bridgeKeys: Object.keys(window.neonDash),
        saveWritten: ok, bestAfterReload: after.best, remoteContent: remote,
        canvas: !!document.querySelector('canvas'),
      };
    })()`);
    const prefs = w.webContents.getLastWebPreferences();
    console.log('SMOKE ' + JSON.stringify({
      ...result,
      contextIsolation: prefs.contextIsolation, nodeIntegration: prefs.nodeIntegration, sandbox: prefs.sandbox,
      saveFolder: app.getPath('userData'),
    }, null, 2));
    app.quit();
  });
}

// Only answer IPC from our own bundled page.
const fromGame = (event) => {
  const url = event.senderFrame?.url ?? '';
  return url === indexUrl || url.startsWith(indexUrl + '#') || url.startsWith(indexUrl + '?');
};

ipcMain.handle('save:load', (event) => (fromGame(event) ? readSave(app.getPath('userData')) : null));
ipcMain.handle('save:write', (event, text) => (fromGame(event) ? writeSave(app.getPath('userData'), text) : false));
ipcMain.handle('app:quit', (event) => { if (fromGame(event)) app.quit(); });

app.on('web-contents-created', (_e, contents) => {
  contents.on('will-attach-webview', (e) => e.preventDefault());
});

app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
