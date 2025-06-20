export interface SpeculosDatasource {
  postApdu(apdu: string): Promise<string>;
}
