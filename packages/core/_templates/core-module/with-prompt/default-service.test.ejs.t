---
to: src/internal/<%= moduleName %>/service/Default<%= h.capitalize(moduleName) %>Service.test.ts
---
import { <%= h.capitalize(moduleName) %>Service } from "./<%= h.capitalize(moduleName) %>Service";
import { Default<%= h.capitalize(moduleName) %>Service } from "./Default<%= h.capitalize(moduleName) %>Service";

let service: <%= h.capitalize(moduleName) %>Service;
describe("<%= h.capitalize(moduleName) %>Service", () => {
  beforeEach(() => {
    service = new Default<%= h.capitalize(moduleName) %>Service();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});