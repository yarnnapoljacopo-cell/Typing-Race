"use strict";

// src/preload.ts
var import_electron = require("electron");
import_electron.contextBridge.exposeInMainWorld("electronAPI", {
  // Save a text file to disk via native dialog
  saveFile: (content, defaultName) => import_electron.ipcRenderer.invoke("save-file", { content, defaultName }),
  // Offline sprint storage
  saveOfflineSprint: (data) => import_electron.ipcRenderer.invoke("save-offline-sprint", data),
  getOfflineSprints: () => import_electron.ipcRenderer.invoke("get-offline-sprints"),
  deleteOfflineSprint: (id) => import_electron.ipcRenderer.invoke("delete-offline-sprint", { id }),
  // Network
  isOnline: () => import_electron.ipcRenderer.invoke("is-online"),
  goOnline: () => import_electron.ipcRenderer.invoke("go-online"),
  goOffline: () => import_electron.ipcRenderer.invoke("go-offline"),
  // Settings
  getSettings: () => import_electron.ipcRenderer.invoke("get-settings"),
  saveSettings: (settings) => import_electron.ipcRenderer.invoke("save-settings", settings),
  // Events from main process (menu items)
  onGoOffline: (cb) => {
    import_electron.ipcRenderer.on("trigger-go-offline", cb);
    return () => import_electron.ipcRenderer.removeListener("trigger-go-offline", cb);
  },
  onGoOnline: (cb) => {
    import_electron.ipcRenderer.on("trigger-go-online", cb);
    return () => import_electron.ipcRenderer.removeListener("trigger-go-online", cb);
  },
  onOpenSettings: (cb) => {
    import_electron.ipcRenderer.on("open-settings", cb);
    return () => import_electron.ipcRenderer.removeListener("open-settings", cb);
  }
});
