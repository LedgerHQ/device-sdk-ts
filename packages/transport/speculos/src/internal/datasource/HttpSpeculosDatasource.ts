import axios from "axios";

import PACKAGE from "@root/package.json";

import { type SpeculosDatasource } from "./SpeculosDatasource";

const TIMEOUT = 5000; // 5 second timeout for availability check

export class HttpSpeculosDatasource implements SpeculosDatasource {
  constructor(private readonly baseUrl: string) {}

  async postAdpu(apdu: string): Promise<string> {
    const requestDto = {
      data: apdu,
    };

    const speculosResponse = await axios.request<SpeculosApduDTO>({
      method: "POST",
      url: `${this.baseUrl}/apdu`,
      data: requestDto,
      headers: {
        "X-Ledger-Client-Version": `ldmk-transport-speculos/${PACKAGE.version}`,
      },
    });

    return speculosResponse.data.data;
  }

  async isServerAvailable(): Promise<boolean> {
    try {
      await axios.request<SpeculosEventsDTO>({
        method: "GET",
        url: `${this.baseUrl}/events`,
        headers: {
          "X-Ledger-Client-Version": `ldmk-transport-speculos/${PACKAGE.version}`,
        },
        timeout: TIMEOUT,
      });
      return true;
    } catch (_error) {
      return false;
    }
  }
}

type SpeculosApduDTO = {
  data: string;
};

type SpeculosEventsDTO = {
  events: Array<{
    text?: string;
    x?: number;
    y?: number;
  }>;
};
