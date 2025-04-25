import axios from "axios";

import PACKAGE from "@root/package.json";

import { type SpeculosDatasource } from "./SpeculosDatasource";
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

  async ping(): Promise<boolean> {
    try {
      await axios.request({
        method: "GET",
        url: `${this.baseUrl}/apdu`,
        timeout: 2000,
        data: {
          data: "0000",
        },
      });

      return true;
    } catch (_) {
      return false;
    }
  }
}

type SpeculosApduDTO = {
  data: string;
};
