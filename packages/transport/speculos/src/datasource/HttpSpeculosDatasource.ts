import axios, { AxiosInstance } from "axios";

import { SpeculosDatasource } from "./SpeculosDatasource";

export class HttpSpeculosDatasource implements SpeculosDatasource {
  private axiosInstance: AxiosInstance;

  constructor(baseUrl: string) {}

  async openConnection(): Promise<void> {
    //OpenWebSocket
  }
  async closeConnection(): Promise<void> {
    closeWebSocket;
  }

  async postAdpu(apdu: string): Promise<string> {
    const speculosResponse = await this.axiosInstance.post();

    return "";
  }
}
