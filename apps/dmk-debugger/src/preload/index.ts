import { contextBridge, ipcRenderer } from "electron";
import { electronAPI } from "@electron-toolkit/preload";

import type { LogEntry } from "../main/store";
import type { AnalysisCommand, AnalysisResult } from "../main/analyzer";
import type { ModelOption } from "../main/claude";

export interface DmkApi {
  listModels: () => Promise<ModelOption[]>;
  onLogEntry: (cb: (entry: LogEntry) => void) => () => void;
  onCleared: (cb: () => void) => () => void;
  getAllLogs: () => Promise<LogEntry[]>;
  clearLogs: () => Promise<void>;
  exportLogs: () => Promise<{ saved: boolean; path?: string }>;
  analyzeLocal: (command: AnalysisCommand) => Promise<AnalysisResult>;
  analyzeAi: (command: string, model?: string) => void;
  cancelAi: () => void;
  onAiChunk: (cb: (chunk: string) => void) => () => void;
  onAiDone: (cb: (fullText: string) => void) => () => void;
  onAiError: (cb: (msg: string) => void) => () => void;
  sendChat: (message: string) => void;
  onChatChunk: (cb: (chunk: string) => void) => () => void;
  onChatDone: (cb: (fullText: string) => void) => () => void;
  onChatError: (cb: (msg: string) => void) => () => void;
  getServerStatus: () => Promise<{
    running: boolean;
    port: number;
    logCount: number;
    recording: boolean;
  }>;
  setRecording: (value: boolean) => Promise<boolean>;
  getRecording: () => Promise<boolean>;
  onRecordingChanged: (cb: (value: boolean) => void) => () => void;
  onServerReady: (cb: (port: number) => void) => () => void;
  onServerError: (cb: (msg: string) => void) => () => void;
}

const dmk: DmkApi = {
  listModels: () => ipcRenderer.invoke("models:list"),

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

  analyzeAi: (command, model) => {
    ipcRenderer.invoke("analyze:ai", command, model);
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

  sendChat: (message) => {
    ipcRenderer.invoke("chat:send", message);
  },
  onChatChunk: (cb) => {
    const handler = (_: unknown, chunk: string): void => cb(chunk);
    ipcRenderer.on("chat:chunk", handler);
    return () => ipcRenderer.removeListener("chat:chunk", handler);
  },
  onChatDone: (cb) => {
    const handler = (_: unknown, fullText: string): void => cb(fullText);
    ipcRenderer.on("chat:done", handler);
    return () => ipcRenderer.removeListener("chat:done", handler);
  },
  onChatError: (cb) => {
    const handler = (_: unknown, msg: string): void => cb(msg);
    ipcRenderer.on("chat:error", handler);
    return () => ipcRenderer.removeListener("chat:error", handler);
  },

  getServerStatus: () => ipcRenderer.invoke("server:status"),

  setRecording: (value) => ipcRenderer.invoke("recording:set", value),
  getRecording: () => ipcRenderer.invoke("recording:get"),
  onRecordingChanged: (cb) => {
    const handler = (_: unknown, value: boolean): void => cb(value);
    ipcRenderer.on("recording:changed", handler);
    return () => ipcRenderer.removeListener("recording:changed", handler);
  },

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
