"use strict";
const electron = require("electron");
const preload = require("@electron-toolkit/preload");
const dmk = {
  listModels: () => electron.ipcRenderer.invoke("models:list"),
  onLogEntry: (cb) => {
    const handler = (_, entry) => cb(entry);
    electron.ipcRenderer.on("logs:entry", handler);
    return () => electron.ipcRenderer.removeListener("logs:entry", handler);
  },
  onCleared: (cb) => {
    const handler = () => cb();
    electron.ipcRenderer.on("logs:cleared", handler);
    return () => electron.ipcRenderer.removeListener("logs:cleared", handler);
  },
  getAllLogs: () => electron.ipcRenderer.invoke("logs:getAll"),
  clearLogs: () => electron.ipcRenderer.invoke("logs:clear"),
  resetSession: () => electron.ipcRenderer.invoke("session:reset"),
  exportLogs: () => electron.ipcRenderer.invoke("logs:export"),
  analyzeLocal: (command) => electron.ipcRenderer.invoke("analyze:local", command),
  analyzeAi: (command, model) => {
    electron.ipcRenderer.invoke("analyze:ai", command, model);
  },
  cancelAi: () => {
    electron.ipcRenderer.invoke("analyze:ai:cancel");
  },
  onAiChunk: (cb) => {
    const handler = (_, chunk) => cb(chunk);
    electron.ipcRenderer.on("ai:chunk", handler);
    return () => electron.ipcRenderer.removeListener("ai:chunk", handler);
  },
  onAiDone: (cb) => {
    const handler = (_, fullText) => cb(fullText);
    electron.ipcRenderer.on("ai:done", handler);
    return () => electron.ipcRenderer.removeListener("ai:done", handler);
  },
  onAiError: (cb) => {
    const handler = (_, msg) => cb(msg);
    electron.ipcRenderer.on("ai:error", handler);
    return () => electron.ipcRenderer.removeListener("ai:error", handler);
  },
  getServerStatus: () => electron.ipcRenderer.invoke("server:status"),
  onServerReady: (cb) => {
    const handler = (_, port) => cb(port);
    electron.ipcRenderer.on("server:ready", handler);
    return () => electron.ipcRenderer.removeListener("server:ready", handler);
  },
  onServerError: (cb) => {
    const handler = (_, msg) => cb(msg);
    electron.ipcRenderer.on("server:error", handler);
    return () => electron.ipcRenderer.removeListener("server:error", handler);
  }
};
if (process.contextIsolated) {
  try {
    electron.contextBridge.exposeInMainWorld("electron", preload.electronAPI);
    electron.contextBridge.exposeInMainWorld("dmk", dmk);
  } catch (error) {
    console.error(error);
  }
} else {
  window.electron = preload.electronAPI;
  window.dmk = dmk;
}
