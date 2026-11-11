const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');

if (!app.requestSingleInstanceLock()) app.quit();

let win;

function safeUrl(s) {
  try {
    const u = new URL(String(s));
    return (u.protocol === 'http:' || u.protocol === 'https:') ? u : null;
  } catch (e) { return null; }
}
// each journal site gets its own persistent session; the app never sees the password
function part(u) { return 'persist:j-' + u.hostname; }

function create() {
  Menu.setApplicationMenu(null);
  win = new BrowserWindow({
    width: 1240, height: 820, minWidth: 900, minHeight: 600,
    title: 'روان‌نویس', backgroundColor: '#f1f5f7',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true
    }
  });
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
}

app.on('second-instance', () => {
  if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
});
app.whenReady().then(() => {
  app.setAppUserModelId('ir.ravannevis.app');
  create();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) create(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ---- secure login: the user signs in on the journal's own page ----
ipcMain.handle('journal:login', (_e, url) => {
  const u = safeUrl(url);
  if (!u) return { ok: false };
  return new Promise((resolve) => {
    const w = new BrowserWindow({
      width: 1000, height: 760, parent: win, title: u.hostname,
      webPreferences: { partition: part(u), contextIsolation: true, nodeIntegration: false, sandbox: true }
    });
    w.removeMenu();
    w.webContents.setWindowOpenHandler(({ url: target }) => {
      const x = safeUrl(target);
      if (x) w.loadURL(x.href);
      return { action: 'deny' };
    });
    w.on('closed', () => resolve({ ok: true, host: u.hostname }));
    w.loadURL(u.href).catch(() => {});
  });
});

// ---- read the journal's guide-for-authors pages with the user's session ----
const KEY = /guide|author|submit|instruction|manuscript|راهنما|نویسنده|ارسال|ثبت مقاله/i;
const norm = (s) => s
  .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
  .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
  .replace(/[,٬،]/g, '');
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error('timeout')), ms))]);

ipcMain.handle('journal:scan', async (_e, url) => {
  const u = safeUrl(url);
  if (!u) return { error: 'لینک معتبر نیست.' };
  const w = new BrowserWindow({
    show: false,
    webPreferences: { partition: part(u), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  try {
    await withTimeout(w.loadURL(u.href), 30000);
    const home = await w.webContents.executeJavaScript(
      "({title:document.title,links:Array.from(document.querySelectorAll('a[href]')).map(function(a){return{t:(a.textContent||'').trim().slice(0,80),h:a.href}})})"
    );
    const seen = new Set();
    const pages = [];
    for (const l of home.links) {
      if (!KEY.test(l.t + ' ' + l.h)) continue;
      const x = safeUrl(l.h);
      if (!x || x.hostname !== u.hostname || seen.has(x.href)) continue;
      seen.add(x.href);
      pages.push({ t: l.t || x.pathname, h: x.href });
      if (pages.length >= 4) break;
    }
    let text = '';
    for (const p of pages) {
      try {
        await withTimeout(w.loadURL(p.h), 30000);
        text += '\n' + await w.webContents.executeJavaScript('document.body.innerText.slice(0,30000)');
      } catch (e) { /* skip page */ }
    }
    text = norm(text);
    let maxWords = null;
    const re = /(\d{4,5})\s*(?:words|word|کلمه|واژه)/gi;
    let m;
    while ((m = re.exec(text))) {
      const n = parseInt(m[1], 10);
      if (n >= 1500 && n <= 30000) { maxWords = n; break; }
    }
    const st = text.match(/\b(APA|MLA|Chicago|Vancouver|Harvard|IEEE)\b/);
    return { host: u.hostname, title: home.title, pages: pages.map((p) => p.t || p.h), maxWords, refStyle: st ? st[1] : null };
  } catch (e) {
    return { error: 'خواندن سایت ممکن نشد. اتصال اینترنت و لینک را بررسی کنید.' };
  } finally {
    w.destroy();
  }
});
