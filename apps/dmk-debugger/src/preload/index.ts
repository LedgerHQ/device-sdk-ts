import { contextBridge, ipcRenderer } from "electron";
import { electronAPI } from "@electron-toolkit/preload";

import type { LogEntry } from "../main/store";
import type { AnalysisCommand, AnalysisResult } from "../main/analyzer";

export interface DmkApi {
  onLogEntry: (cb: (entry: LogEntry) => void) => () => void;
  onCleared: (cb: () => void) => () => void;
  getAllLogs: () => Promise<LogEntry[]>;
  clearLogs: () => Promise<void>;
  exportLogs: () => Promise<{ saved: boolean; path?: string }>;
  analyzeLocal: (command: AnalysisCommand) => Promise<AnalysisResult>;
  analyzeAi: (command: string) => void;
  cancelAi: () => void;
  onAiChunk: (cb: (chunk: string) => void) => () => void;
  onAiDone: (cb: (fullText: string) => void) => () => void;
  onAiError: (cb: (msg: string) => void) => () => void;
  getServerStatus: () => Promise<{ running: boolean; port: number; logCount: number }>;
  onServerReady: (cb: (port: number) => void) => () => void;
  onServerError: (cb: (msg: string) => void) => () => void;
}

const dmk: DmkApi = {
  onLogEntry: (cb) => {
    const handler = (_: unknown, entry: LogEntry): void => cb(entry);
    ipcRenderer.on("logs:entry", handler);
    return () => ipcRenderer.removeListener("logs:entry", handler);
  },

  onCleared: (cb) => {
    const handler = (): void => cb();
    ipcRenderer.on("logs:cleared", handler);
    return () => ipcRenderer.removeListener("logs:cleared", handler);
  },

  getAllLogs: () => ipcRenderer.invoke("logs:getAll"),
  clearLogs: () => ipcRenderer.invoke("logs:clear"),
  exportLogs: () => ipcRenderer.invoke("logs:export"),
  analyzeLocal: (command) => ipcRenderer.invoke("analyze:local", command),

  analyzeAi: (command) => {
    ipcRenderer.invoke("analyze:ai", command);
  },
  cancelAi: () => {
    ipcRenderer.invoke("analyze:ai:cancel");
  },

  onAiChunk: (cb) => {
    const handler = (_: unknown, chunk: string): void => cb(chunk);
    ipcRenderer.on("ai:chunk", handler);
    return () => ipcRenderer.removeListener("ai:chunk", handler);
  },

  onAiDone: (cb) => {
    const handler = (_: unknown, fullText: string): void => cb(fullText);
    ipcRenderer.on("ai:done", handler);
    return () => ipcRenderer.removeListener("ai:done", handler);
  },

  onAiError: (cb) => {
    const handler = (_: unknown, msg: string): void => cb(msg);
    ipcRenderer.on("ai:error", handler);
    return () => ipcRenderer.removeListener("ai:error", handler);
  },

  getServerStatus: () => ipcRenderer.invoke("server:status"),

  onServerReady: (cb) => {
    const handler = (_: unknown, port: number): void => cb(port);
    ipcRenderer.on("server:ready", handler);
    return () => ipcRenderer.removeListener("server:ready", handler);
  },

  onServerError: (cb) => {
    const handler = (_: unknown, msg: string): void => cb(msg);
    ipcRenderer.on("server:error", handler);
    return () => ipcRenderer.removeListener("server:error", handler);
  },
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI);
    contextBridge.exposeInMainWorld("dmk", dmk);
  } catch (error) {
    console.error(error);
  }
} else {
  (window as unknown as Record<string, unknown>).electron = electronAPI;
  (window as unknown as Record<string, unknown>).dmk = dmk;
}
