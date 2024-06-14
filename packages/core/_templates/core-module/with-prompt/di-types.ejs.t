---
to: src/internal/<%= moduleName %>/di/<%= moduleName %>Types.ts
---
export const types = {
  <%= h.capitalize(moduleName) %>Service: Symbol.for("<%= h.capitalize(moduleName) %>Service"),
};