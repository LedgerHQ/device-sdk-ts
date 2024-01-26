---
to: src/internal/<%= moduleName %>/service/Default<%= h.capitalize(moduleName) %>Service.ts
---
import { injectable } from "inversify";
import { <%= h.capitalize(moduleName) %>Service } from "./<%= h.capitalize(moduleName) %>Service";

@injectable()
export class Default<%= h.capitalize(moduleName) %>Service implements <%= h.capitalize(moduleName) %>Service {
  constructor() {}
}