export interface SpeculosDatasource {
  postAdpu(apdu: string): Promise<string>;
  isServerAvailable(): Promise<boolean>;
}
