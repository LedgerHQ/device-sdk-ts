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
  sendChat: (message) => {
    electron.ipcRenderer.invoke("chat:send", message);
  },
  onChatChunk: (cb) => {
    const handler = (_, chunk) => cb(chunk);
    electron.ipcRenderer.on("chat:chunk", handler);
    return () => electron.ipcRenderer.removeListener("chat:chunk", handler);
  },
  onChatDone: (cb) => {
    const handler = (_, fullText) => cb(fullText);
    electron.ipcRenderer.on("chat:done", handler);
    return () => electron.ipcRenderer.removeListener("chat:done", handler);
  },
  onChatError: (cb) => {
    const handler = (_, msg) => cb(msg);
    electron.ipcRenderer.on("chat:error", handler);
    return () => electron.ipcRenderer.removeListener("chat:error", handler);
  },
  getServerStatus: () => electron.ipcRenderer.invoke("server:status"),
  setRecording: (value) => electron.ipcRenderer.invoke("recording:set", value),
  getRecording: () => electron.ipcRenderer.invoke("recording:get"),
  onRecordingChanged: (cb) => {
    const handler = (_, value) => cb(value);
    electron.ipcRenderer.on("recording:changed", handler);
    return () => electron.ipcRenderer.removeListener("recording:changed", handler);
  },
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
