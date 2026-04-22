"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const https_1 = __importDefault(require("https"));
const http_1 = __importDefault(require("http"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
// ── Config ────────────────────────────────────────────────────────────────────
const CONFIG_DIR = path_1.default.join(electron_1.app.getPath("userData"), "writing-sprint");
const CONFIG_FILE = path_1.default.join(CONFIG_DIR, "settings.json");
const DB_FILE = path_1.default.join(CONFIG_DIR, "offline.db");
const DEFAULT_SETTINGS = {
    serverUrl: "https://d22a5c75-44c4-4fa4-b065-5daabd4c141e-00-1uzgmrqpol43r.riker.replit.dev/writing-sprint/",
    theme: "system",
};
function loadSettings() {
    try {
        if (fs_1.default.existsSync(CONFIG_FILE)) {
            return { ...DEFAULT_SETTINGS, ...JSON.parse(fs_1.default.readFileSync(CONFIG_FILE, "utf-8")) };
        }
    }
    catch { }
    return { ...DEFAULT_SETTINGS };
}
function saveSettings(s) {
    fs_1.default.mkdirSync(CONFIG_DIR, { recursive: true });
    fs_1.default.writeFileSync(CONFIG_FILE, JSON.stringify(s, null, 2));
}
// ── Offline SQLite DB ─────────────────────────────────────────────────────────
function openDb() {
    fs_1.default.mkdirSync(CONFIG_DIR, { recursive: true });
    const db = new better_sqlite3_1.default(DB_FILE);
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
let _db = null;
function getDb() {
    if (!_db)
        _db = openDb();
    return _db;
}
// ── Network check ─────────────────────────────────────────────────────────────
function checkOnline(url) {
    return new Promise((resolve) => {
        const parsed = new URL(url);
        const mod = parsed.protocol === "https:" ? https_1.default : http_1.default;
        const req = mod.request({ hostname: parsed.hostname, port: parsed.port || (parsed.protocol === "https:" ? 443 : 80), path: "/", method: "HEAD", timeout: 4000 }, () => resolve(true));
        req.on("error", () => resolve(false));
        req.on("timeout", () => { req.destroy(); resolve(false); });
        req.end();
    });
}
// ── Main window ───────────────────────────────────────────────────────────────
let mainWindow = null;
let isOnline = false;
let currentSettings = loadSettings();
function getOfflinePath() {
    const inAsar = path_1.default.join(process.resourcesPath, "offline.html");
    const inDev = path_1.default.join(__dirname, "../src/offline.html");
    return fs_1.default.existsSync(inAsar) ? inAsar : inDev;
}
async function createWindow() {
    currentSettings = loadSettings();
    electron_1.nativeTheme.themeSource = currentSettings.theme ?? "system";
    mainWindow = new electron_1.BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 900,
        minHeight: 600,
        titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
        webPreferences: {
            preload: path_1.default.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            spellcheck: true,
        },
        show: false,
    });
    mainWindow.once("ready-to-show", () => mainWindow?.show());
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        electron_1.shell.openExternal(url);
        return { action: "deny" };
    });
    isOnline = await checkOnline(currentSettings.serverUrl);
    if (isOnline) {
        await mainWindow.loadURL(currentSettings.serverUrl);
        injectElectronBridge(mainWindow);
    }
    else {
        await mainWindow.loadFile(getOfflinePath());
    }
    buildMenu();
}
// Inject a small bridge into the live web app so it can call Electron APIs
function injectElectronBridge(win) {
    win.webContents.on("did-finish-load", () => {
        win.webContents.executeJavaScript(`
      window.__ELECTRON__ = true;
      console.log('[Writing Sprint Desktop] Running in Electron — native features active');
    `).catch(() => { });
    });
}
// ── IPC Handlers ──────────────────────────────────────────────────────────────
// Save file to disk with native dialog
electron_1.ipcMain.handle("save-file", async (_e, { content, defaultName }) => {
    if (!mainWindow)
        return { saved: false };
    const { filePath, canceled } = await electron_1.dialog.showSaveDialog(mainWindow, {
        defaultPath: defaultName,
        filters: [
            { name: "Text Files", extensions: ["txt"] },
            { name: "All Files", extensions: ["*"] },
        ],
    });
    if (canceled || !filePath)
        return { saved: false };
    fs_1.default.writeFileSync(filePath, content, "utf-8");
    return { saved: true, path: filePath };
});
// Save offline sprint to local SQLite
electron_1.ipcMain.handle("save-offline-sprint", (_e, { duration, words, text, goal }) => {
    const db = getDb();
    const result = db.prepare("INSERT INTO offline_sprints (duration, words, text, goal) VALUES (?, ?, ?, ?)").run(duration, words, text, goal ?? null);
    return { id: result.lastInsertRowid };
});
// Get all offline sprints
electron_1.ipcMain.handle("get-offline-sprints", () => {
    const db = getDb();
    return db.prepare("SELECT * FROM offline_sprints ORDER BY created_at DESC").all();
});
// Delete an offline sprint
electron_1.ipcMain.handle("delete-offline-sprint", (_e, { id }) => {
    const db = getDb();
    db.prepare("DELETE FROM offline_sprints WHERE id = ?").run(id);
    return { ok: true };
});
// Check network status
electron_1.ipcMain.handle("is-online", async () => {
    isOnline = await checkOnline(currentSettings.serverUrl);
    return isOnline;
});
// Load the live app (called from offline page when user goes online)
electron_1.ipcMain.handle("go-online", async () => {
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
electron_1.ipcMain.handle("go-offline", async () => {
    if (mainWindow) {
        await mainWindow.loadFile(getOfflinePath());
        buildMenu();
    }
    return { ok: true };
});
// Get and update settings
electron_1.ipcMain.handle("get-settings", () => loadSettings());
electron_1.ipcMain.handle("save-settings", (_e, settings) => {
    saveSettings(settings);
    currentSettings = settings;
    electron_1.nativeTheme.themeSource = settings.theme ?? "system";
    return { ok: true };
});
// ── Menu ──────────────────────────────────────────────────────────────────────
function buildMenu() {
    const isMac = process.platform === "darwin";
    const template = [
        ...(isMac ? [{ label: electron_1.app.name, submenu: [
                    { role: "about" },
                    { type: "separator" },
                    { role: "services" },
                    { type: "separator" },
                    { role: "hide" },
                    { role: "hideOthers" },
                    { role: "unhide" },
                    { type: "separator" },
                    { role: "quit" },
                ] }] : []),
        {
            label: "File",
            submenu: [
                {
                    label: "Export Writing to File…",
                    accelerator: "CmdOrCtrl+S",
                    click: async () => {
                        if (!mainWindow)
                            return;
                        try {
                            const text = await mainWindow.webContents.executeJavaScript(`(function(){
                  const ta = document.querySelector('textarea[data-writing]') || document.querySelector('.writing-area textarea') || document.querySelector('textarea');
                  return ta ? ta.value : '';
                })()`);
                            if (!text || !text.trim()) {
                                electron_1.dialog.showMessageBox(mainWindow, { type: "info", message: "No writing found in the current page." });
                                return;
                            }
                            const { filePath, canceled } = await electron_1.dialog.showSaveDialog(mainWindow, {
                                defaultPath: `sprint-${new Date().toISOString().slice(0, 10)}.txt`,
                                filters: [{ name: "Text Files", extensions: ["txt"] }, { name: "All Files", extensions: ["*"] }],
                            });
                            if (!canceled && filePath) {
                                fs_1.default.writeFileSync(filePath, text, "utf-8");
                                electron_1.dialog.showMessageBox(mainWindow, { type: "info", message: `Saved to ${filePath}` });
                            }
                        }
                        catch { }
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
                isMac ? { role: "close" } : { role: "quit" },
            ],
        },
        {
            label: "Edit",
            submenu: [
                { role: "undo" },
                { role: "redo" },
                { type: "separator" },
                { role: "cut" },
                { role: "copy" },
                { role: "paste" },
                ...(isMac
                    ? [{ role: "pasteAndMatchStyle" }, { role: "delete" }, { role: "selectAll" }]
                    : [{ role: "delete" }, { type: "separator" }, { role: "selectAll" }]),
            ],
        },
        {
            label: "View",
            submenu: [
                { role: "reload" },
                { role: "forceReload" },
                { type: "separator" },
                { role: "resetZoom" },
                { role: "zoomIn" },
                { role: "zoomOut" },
                { type: "separator" },
                { role: "togglefullscreen" },
                { type: "separator" },
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
                { role: "minimize" },
                { role: "zoom" },
                ...(isMac ? [{ type: "separator" }, { role: "front" }] : [{ role: "close" }]),
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
                    click: () => electron_1.shell.openExternal(currentSettings.serverUrl),
                },
            ],
        },
    ];
    electron_1.Menu.setApplicationMenu(electron_1.Menu.buildFromTemplate(template));
}
// ── App lifecycle ─────────────────────────────────────────────────────────────
electron_1.app.whenReady().then(() => {
    // Accept self-signed certs in dev
    if (process.env.NODE_ENV === "development") {
        electron_1.session.defaultSession.setCertificateVerifyProc((_req, cb) => cb(0));
    }
    createWindow();
});
electron_1.app.on("window-all-closed", () => {
    if (process.platform !== "darwin")
        electron_1.app.quit();
});
electron_1.app.on("activate", () => {
    if (electron_1.BrowserWindow.getAllWindows().length === 0)
        createWindow();
});
