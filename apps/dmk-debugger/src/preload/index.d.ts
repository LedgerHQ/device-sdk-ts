import { ElectronAPI } from "@electron-toolkit/preload";
import type { DmkApi } from "./index";

declare global {
  interface Window {
    electron: ElectronAPI;
    dmk: DmkApi;
  }
}
