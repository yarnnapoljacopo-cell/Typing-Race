"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld("electronAPI", {
    // Save a text file to disk via native dialog
    saveFile: (content, defaultName) => electron_1.ipcRenderer.invoke("save-file", { content, defaultName }),
    // Offline sprint storage
    saveOfflineSprint: (data) => electron_1.ipcRenderer.invoke("save-offline-sprint", data),
    getOfflineSprints: () => electron_1.ipcRenderer.invoke("get-offline-sprints"),
    deleteOfflineSprint: (id) => electron_1.ipcRenderer.invoke("delete-offline-sprint", { id }),
    // Network
    isOnline: () => electron_1.ipcRenderer.invoke("is-online"),
    goOnline: () => electron_1.ipcRenderer.invoke("go-online"),
    goOffline: () => electron_1.ipcRenderer.invoke("go-offline"),
    // Settings
    getSettings: () => electron_1.ipcRenderer.invoke("get-settings"),
    saveSettings: (settings) => electron_1.ipcRenderer.invoke("save-settings", settings),
    // Events from main process (menu items)
    onGoOffline: (cb) => {
        electron_1.ipcRenderer.on("trigger-go-offline", cb);
        return () => electron_1.ipcRenderer.removeListener("trigger-go-offline", cb);
    },
    onGoOnline: (cb) => {
        electron_1.ipcRenderer.on("trigger-go-online", cb);
        return () => electron_1.ipcRenderer.removeListener("trigger-go-online", cb);
    },
    onOpenSettings: (cb) => {
        electron_1.ipcRenderer.on("open-settings", cb);
        return () => electron_1.ipcRenderer.removeListener("open-settings", cb);
    },
});
