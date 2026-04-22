import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  // Save a text file to disk via native dialog
  saveFile: (content: string, defaultName: string) =>
    ipcRenderer.invoke("save-file", { content, defaultName }),

  // Offline sprint storage
  saveOfflineSprint: (data: { duration: number; words: number; text: string; goal?: number }) =>
    ipcRenderer.invoke("save-offline-sprint", data),
  getOfflineSprints: () =>
    ipcRenderer.invoke("get-offline-sprints"),
  deleteOfflineSprint: (id: number) =>
    ipcRenderer.invoke("delete-offline-sprint", { id }),

  // Network
  isOnline: () => ipcRenderer.invoke("is-online"),
  goOnline: () => ipcRenderer.invoke("go-online"),
  goOffline: () => ipcRenderer.invoke("go-offline"),

  // Settings
  getSettings: () => ipcRenderer.invoke("get-settings"),
  saveSettings: (settings: Record<string, string>) =>
    ipcRenderer.invoke("save-settings", settings),

  // Offline sprint file operations (desktop only)
  saveDraft: (text: string) =>
    ipcRenderer.invoke("save-draft", { text }),
  saveRecovery: (text: string) =>
    ipcRenderer.invoke("save-recovery", { text }),
  checkRecovery: (): Promise<{ exists: boolean; content?: string }> =>
    ipcRenderer.invoke("check-recovery"),
  dismissRecovery: () =>
    ipcRenderer.invoke("dismiss-recovery"),
  saveSprintFile: (text: string, defaultName: string) =>
    ipcRenderer.invoke("save-sprint-file", { text, defaultName }),
  syncOfflineSprint: (data: { duration: number; words: number; text: string }) =>
    ipcRenderer.invoke("sync-offline-sprint", data),

  // Events from main process (menu items)
  onGoOffline: (cb: () => void) => {
    ipcRenderer.on("trigger-go-offline", cb);
    return () => ipcRenderer.removeListener("trigger-go-offline", cb);
  },
  onGoOnline: (cb: () => void) => {
    ipcRenderer.on("trigger-go-online", cb);
    return () => ipcRenderer.removeListener("trigger-go-online", cb);
  },
  onOpenSettings: (cb: () => void) => {
    ipcRenderer.on("open-settings", cb);
    return () => ipcRenderer.removeListener("open-settings", cb);
  },
});
