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

// ── Config ────────────────────────────────────────────────────────────────────

const CONFIG_DIR = path.join(app.getPath("userData"), "writing-sprint");
const CONFIG_FILE = path.join(CONFIG_DIR, "settings.json");
const SPRINTS_FILE = path.join(CONFIG_DIR, "offline-sprints.json");

const DEFAULT_SETTINGS = {
  serverUrl: "",
  theme: "system",
};

function loadSettings(): typeof DEFAULT_SETTINGS {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
      // Migrate: clear any saved Replit dev-preview URL — those are not valid production URLs
      if (saved.serverUrl && (saved.serverUrl.includes("replit.dev") || saved.serverUrl.includes("riker.replit.dev"))) {
        saved.serverUrl = "";
      }
      return { ...DEFAULT_SETTINGS, ...saved };
    }
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(s: typeof DEFAULT_SETTINGS) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(s, null, 2));
}

// ── Offline Sprint Storage (JSON, no native deps) ─────────────────────────────

interface OfflineSprint {
  id: number;
  duration: number;
  words: number;
  text: string;
  goal: number | null;
  created_at: string;
}

function readSprints(): OfflineSprint[] {
  try {
    if (fs.existsSync(SPRINTS_FILE)) {
      return JSON.parse(fs.readFileSync(SPRINTS_FILE, "utf-8")) as OfflineSprint[];
    }
  } catch {}
  return [];
}

function writeSprints(sprints: OfflineSprint[]) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(SPRINTS_FILE, JSON.stringify(sprints, null, 2));
}

function nextId(sprints: OfflineSprint[]): number {
  return sprints.length === 0 ? 1 : Math.max(...sprints.map((s) => s.id)) + 1;
}

// ── Network check ─────────────────────────────────────────────────────────────

function checkOnline(url: string): Promise<boolean> {
  if (!url) return Promise.resolve(false);
  return new Promise((resolve) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === "https:" ? https : http;
    const req = mod.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
        path: parsed.pathname || "/",
        method: "HEAD",
        timeout: 4000,
      },
      (res) => resolve(res.statusCode !== undefined && res.statusCode < 400),
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

function injectElectronBridge(win: BrowserWindow) {
  win.webContents.on("did-finish-load", () => {
    win.webContents.executeJavaScript(`
      window.__ELECTRON__ = true;
      console.log('[Writing Sprint Desktop] Running in Electron — native features active');
    `).catch(() => {});
  });
}

// ── IPC Handlers ──────────────────────────────────────────────────────────────

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

ipcMain.handle("save-offline-sprint", (_e, { duration, words, text, goal }: { duration: number; words: number; text: string; goal?: number }) => {
  const sprints = readSprints();
  const sprint: OfflineSprint = {
    id: nextId(sprints),
    duration,
    words,
    text,
    goal: goal ?? null,
    created_at: new Date().toISOString(),
  };
  sprints.push(sprint);
  writeSprints(sprints);
  return { id: sprint.id };
});

ipcMain.handle("get-offline-sprints", () => {
  return readSprints().sort((a, b) => b.created_at.localeCompare(a.created_at));
});

ipcMain.handle("delete-offline-sprint", (_e, { id }: { id: number }) => {
  const sprints = readSprints().filter((s) => s.id !== id);
  writeSprints(sprints);
  return { ok: true };
});

ipcMain.handle("is-online", async () => {
  isOnline = await checkOnline(currentSettings.serverUrl);
  return isOnline;
});

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

ipcMain.handle("go-offline", async () => {
  if (mainWindow) {
    await mainWindow.loadFile(getOfflinePath());
    buildMenu();
  }
  return { ok: true };
});

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
