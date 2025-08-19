import axios from "axios";

import PACKAGE from "@root/package.json";

export class HttpLegacySpeculosDatasource {
  private readonly client;

  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs = 10000,
  ) {
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeoutMs,
      headers: {
        "X-Ledger-Client-Version": `ldmk-transport-speculos/${PACKAGE.version}`,
      },
      transitional: { clarifyTimeoutError: true },
    });
  }

  private async postOnce(apdu: string, ms: number): Promise<string> {
    const ac = new AbortController();
    const killer = setTimeout(() => ac.abort(), ms);
    try {
      const { data } = await this.client.post<SpeculosApduDTO>(
        "/apdu",
        { data: apdu },
        { timeout: ms, signal: ac.signal },
      );
      return data.data;
    } finally {
      clearTimeout(killer);
    }
  }

  async postAdpu(apdu: string): Promise<string> {
    const perTryMs = Math.min(1500, this.timeoutMs);
    const tries = Math.max(1, Math.floor(this.timeoutMs / perTryMs));
    let lastErr: unknown;
    for (let i = 0; i < tries; i++) {
      try {
        return await this.postOnce(apdu, perTryMs);
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, 150));
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }
}

type SpeculosApduDTO = {
  data: string;
};
