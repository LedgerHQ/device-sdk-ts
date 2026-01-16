export interface JsonParser {
  parse<T>(content: string): T;
}
