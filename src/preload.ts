import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  getVersion: () => ipcRenderer.invoke("get-version"),
  getPlatform: () => process.platform,
  navBack: () => ipcRenderer.invoke("nav-back"),
  navForward: () => ipcRenderer.invoke("nav-forward"),
  navCanGoBack: () => ipcRenderer.invoke("nav-can-go-back"),
  navCanGoForward: () => ipcRenderer.invoke("nav-can-go-forward"),
  setTheme: (theme: string) => ipcRenderer.invoke("set-theme", theme),
  invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
  showOpenDialog: (options: Record<string, unknown>) => ipcRenderer.invoke("dialog:open-file", options),
});
