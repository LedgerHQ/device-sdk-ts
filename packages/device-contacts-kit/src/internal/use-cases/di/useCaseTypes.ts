export const useCaseTypes = {
  RegisterExternalAddressUseCase: Symbol.for("RegisterExternalAddressUseCase"),
  RenameContactUseCase: Symbol.for("RenameContactUseCase"),
  EditExternalAddressIdentifierUseCase: Symbol.for(
    "EditExternalAddressIdentifierUseCase",
  ),
  EditExternalAddressScopeUseCase: Symbol.for(
    "EditExternalAddressScopeUseCase",
  ),
} as const;
