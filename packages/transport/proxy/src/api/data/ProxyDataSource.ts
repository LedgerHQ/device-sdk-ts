export interface ProxyDataSource {
  postAdpu(apduHex: string): Promise<string>;
}
