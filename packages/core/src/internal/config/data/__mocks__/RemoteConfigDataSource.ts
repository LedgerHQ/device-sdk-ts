import { RemoteConfigDataSource } from "@internal/config/data/ConfigDataSource";

export class RestRemoteConfigDataSource implements RemoteConfigDataSource {
  getConfig = jest.fn();
  _parseResponse = jest.fn();
  _callApi = jest.fn();
}
