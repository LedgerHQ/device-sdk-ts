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
        "X-Ledger-Client-Version": `lmdk-transport-speculos/${PACKAGE.version}`,
      },
    });

    return speculosResponse.data.data;
  }
}

type SpeculosApduDTO = {
  data: string;
};
