export const useCaseTypes = {
  RegisterExternalAddressUseCase: Symbol.for("RegisterExternalAddressUseCase"),
  RenameContactUseCase: Symbol.for("RenameContactUseCase"),
  EditExternalAddressIdentifierUseCase: Symbol.for(
    "EditExternalAddressIdentifierUseCase",
  ),
} as const;
