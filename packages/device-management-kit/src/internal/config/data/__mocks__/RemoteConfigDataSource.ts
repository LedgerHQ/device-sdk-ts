import { type RemoteConfigDataSource } from "@internal/config/data/ConfigDataSource";

export class RestRemoteConfigDataSource implements RemoteConfigDataSource {
  getConfig = vi.fn();
  _parseResponse = vi.fn();
  _callApi = vi.fn();
}
