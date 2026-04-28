import { type KeyValueStorage } from "@ledgerhq/device-management-kit";

export class LocalStorage implements KeyValueStorage {
  public async getItem(key: string): Promise<string | null> {
    return Promise.resolve(window.localStorage.getItem(key));
  }

  public async setItem(key: string, value: string): Promise<void> {
    return Promise.resolve(window.localStorage.setItem(key, value));
  }

  public async removeItem(key: string): Promise<void> {
    return Promise.resolve(window.localStorage.removeItem(key));
  }
}
