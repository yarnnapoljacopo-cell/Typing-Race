import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  Menu,
  nativeTheme,
  session,
} from "electron";
import path from "path";
import fs from "fs";
import https from "https";
import http from "http";
import Database from "better-sqlite3";

// ── Config ────────────────────────────────────────────────────────────────────

const CONFIG_DIR = path.join(app.getPath("userData"), "writing-sprint");
const CONFIG_FILE = path.join(CONFIG_DIR, "settings.json");
const DB_FILE = path.join(CONFIG_DIR, "offline.db");

const DEFAULT_SETTINGS = {
  serverUrl: "https://d22a5c75-44c4-4fa4-b065-5daabd4c141e-00-1uzgmrqpol43r.riker.replit.dev/writing-sprint/",
  theme: "system",
};

function loadSettings(): typeof DEFAULT_SETTINGS {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8")) };
    }
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(s: typeof DEFAULT_SETTINGS) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(s, null, 2));
}

// ── Offline SQLite DB ─────────────────────────────────────────────────────────

function openDb(): Database.Database {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  const db = new Database(DB_FILE);
  db.exec(`
    CREATE TABLE IF NOT EXISTS offline_sprints (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      duration INTEGER NOT NULL,
      words    INTEGER NOT NULL,
      text     TEXT    NOT NULL,
      goal     INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}

let _db: Database.Database | null = null;
function getDb() {
  if (!_db) _db = openDb();
  return _db;
}

// ── Network check ─────────────────────────────────────────────────────────────

function checkOnline(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === "https:" ? https : http;
    const req = mod.request(
      { hostname: parsed.hostname, port: parsed.port || (parsed.protocol === "https:" ? 443 : 80), path: "/", method: "HEAD", timeout: 4000 },
      () => resolve(true),
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
    req.end();
  });
}

// ── Main window ───────────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;
let isOnline = false;
let currentSettings = loadSettings();

function getOfflinePath() {
  const inAsar = path.join(process.resourcesPath, "offline.html");
  const inDev = path.join(__dirname, "../src/offline.html");
  return fs.existsSync(inAsar) ? inAsar : inDev;
}

async function createWindow() {
  currentSettings = loadSettings();
  nativeTheme.themeSource = (currentSettings.theme as "system" | "light" | "dark") ?? "system";

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
    },
    show: false,
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  isOnline = await checkOnline(currentSettings.serverUrl);

  if (isOnline) {
    await mainWindow.loadURL(currentSettings.serverUrl);
    injectElectronBridge(mainWindow);
  } else {
    await mainWindow.loadFile(getOfflinePath());
  }

  buildMenu();
}

// Inject a small bridge into the live web app so it can call Electron APIs
function injectElectronBridge(win: BrowserWindow) {
  win.webContents.on("did-finish-load", () => {
    win.webContents.executeJavaScript(`
      window.__ELECTRON__ = true;
      console.log('[Writing Sprint Desktop] Running in Electron — native features active');
    `).catch(() => {});
  });
}

// ── IPC Handlers ──────────────────────────────────────────────────────────────

// Save file to disk with native dialog
ipcMain.handle("save-file", async (_e, { content, defaultName }: { content: string; defaultName: string }) => {
  if (!mainWindow) return { saved: false };
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName,
    filters: [
      { name: "Text Files", extensions: ["txt"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });
  if (canceled || !filePath) return { saved: false };
  fs.writeFileSync(filePath, content, "utf-8");
  return { saved: true, path: filePath };
});

// Save offline sprint to local SQLite
ipcMain.handle("save-offline-sprint", (_e, { duration, words, text, goal }: { duration: number; words: number; text: string; goal?: number }) => {
  const db = getDb();
  const result = db.prepare(
    "INSERT INTO offline_sprints (duration, words, text, goal) VALUES (?, ?, ?, ?)"
  ).run(duration, words, text, goal ?? null);
  return { id: result.lastInsertRowid };
});

// Get all offline sprints
ipcMain.handle("get-offline-sprints", () => {
  const db = getDb();
  return db.prepare("SELECT * FROM offline_sprints ORDER BY created_at DESC").all();
});

// Delete an offline sprint
ipcMain.handle("delete-offline-sprint", (_e, { id }: { id: number }) => {
  const db = getDb();
  db.prepare("DELETE FROM offline_sprints WHERE id = ?").run(id);
  return { ok: true };
});

// Check network status
ipcMain.handle("is-online", async () => {
  isOnline = await checkOnline(currentSettings.serverUrl);
  return isOnline;
});

// Load the live app (called from offline page when user goes online)
ipcMain.handle("go-online", async () => {
  isOnline = await checkOnline(currentSettings.serverUrl);
  if (isOnline && mainWindow) {
    await mainWindow.loadURL(currentSettings.serverUrl);
    injectElectronBridge(mainWindow);
    buildMenu();
    return { online: true };
  }
  return { online: false };
});

// Load the offline page
ipcMain.handle("go-offline", async () => {
  if (mainWindow) {
    await mainWindow.loadFile(getOfflinePath());
    buildMenu();
  }
  return { ok: true };
});

// Get and update settings
ipcMain.handle("get-settings", () => loadSettings());
ipcMain.handle("save-settings", (_e, settings: typeof DEFAULT_SETTINGS) => {
  saveSettings(settings);
  currentSettings = settings;
  nativeTheme.themeSource = (settings.theme as "system" | "light" | "dark") ?? "system";
  return { ok: true };
});

// ── Menu ──────────────────────────────────────────────────────────────────────

function buildMenu() {
  const isMac = process.platform === "darwin";

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac ? [{ label: app.name, submenu: [
      { role: "about" as const },
      { type: "separator" as const },
      { role: "services" as const },
      { type: "separator" as const },
      { role: "hide" as const },
      { role: "hideOthers" as const },
      { role: "unhide" as const },
      { type: "separator" as const },
      { role: "quit" as const },
    ] }] : []),
    {
      label: "File",
      submenu: [
        {
          label: "Export Writing to File…",
          accelerator: "CmdOrCtrl+S",
          click: async () => {
            if (!mainWindow) return;
            try {
              const text = await mainWindow.webContents.executeJavaScript(
                `(function(){
                  const ta = document.querySelector('textarea[data-writing]') || document.querySelector('.writing-area textarea') || document.querySelector('textarea');
                  return ta ? ta.value : '';
                })()`
              );
              if (!text || !text.trim()) {
                dialog.showMessageBox(mainWindow, { type: "info", message: "No writing found in the current page." });
                return;
              }
              const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
                defaultPath: `sprint-${new Date().toISOString().slice(0, 10)}.txt`,
                filters: [{ name: "Text Files", extensions: ["txt"] }, { name: "All Files", extensions: ["*"] }],
              });
              if (!canceled && filePath) {
                fs.writeFileSync(filePath, text, "utf-8");
                dialog.showMessageBox(mainWindow, { type: "info", message: `Saved to ${filePath}` });
              }
            } catch {}
          },
        },
        { type: "separator" },
        {
          label: "Go Offline (Solo Mode)",
          click: () => mainWindow?.webContents.send("trigger-go-offline"),
        },
        {
          label: "Connect to Live Server",
          click: () => mainWindow?.webContents.send("trigger-go-online"),
        },
        { type: "separator" },
        isMac ? { role: "close" as const } : { role: "quit" as const },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" as const },
        { role: "redo" as const },
        { type: "separator" as const },
        { role: "cut" as const },
        { role: "copy" as const },
        { role: "paste" as const },
        ...(isMac
          ? [{ role: "pasteAndMatchStyle" as const }, { role: "delete" as const }, { role: "selectAll" as const }]
          : [{ role: "delete" as const }, { type: "separator" as const }, { role: "selectAll" as const }]),
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" as const },
        { role: "forceReload" as const },
        { type: "separator" as const },
        { role: "resetZoom" as const },
        { role: "zoomIn" as const },
        { role: "zoomOut" as const },
        { type: "separator" as const },
        { role: "togglefullscreen" as const },
        { type: "separator" as const },
        {
          label: "Toggle Developer Tools",
          accelerator: isMac ? "Alt+Command+I" : "Ctrl+Shift+I",
          click: () => mainWindow?.webContents.toggleDevTools(),
        },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" as const },
        { role: "zoom" as const },
        ...(isMac ? [{ type: "separator" as const }, { role: "front" as const }] : [{ role: "close" as const }]),
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Settings…",
          click: () => mainWindow?.webContents.send("open-settings"),
        },
        { type: "separator" },
        {
          label: "Open Writing Sprint Website",
          click: () => shell.openExternal(currentSettings.serverUrl),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  // Accept self-signed certs in dev
  if (process.env.NODE_ENV === "development") {
    session.defaultSession.setCertificateVerifyProc((_req, cb) => cb(0));
  }
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
