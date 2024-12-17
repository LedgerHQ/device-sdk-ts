export interface SpeculosDatasource {
  postAdpu(apdu: string): Promise<string>;
}
