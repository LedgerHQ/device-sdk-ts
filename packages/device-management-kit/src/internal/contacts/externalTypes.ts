// Inversify symbols for dependencies injected into the contacts internal
// container from the ContactsServiceBuilder. Scoped to this package's
// contacts module — does not interact with DMK's main DI container.
export const contactsExternalTypes = {
  Dmk: Symbol.for("ContactsDmk"),
  SessionId: Symbol.for("ContactsSessionId"),
  DmkLoggerFactory: Symbol.for("ContactsDmkLoggerFactory"),
};
