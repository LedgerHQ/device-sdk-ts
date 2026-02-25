type Primitive = string | number | boolean | null | undefined;

export interface JsonObject {
  [key: string]: Primitive | Primitive[] | JsonObject | JsonObject[];
}
