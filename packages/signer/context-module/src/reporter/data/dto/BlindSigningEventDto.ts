export type BlindSigningEventEthContextDto = {
  clearSigningType: "basic" | "eip7730";
  partialContextErrors: number;
};

export type BlindSigningEventDto = {
  signatureId: string;
  signingMethod: "eth_signTransaction" | "eth_signTypedData";
  source: string;
  isBlindSign?: boolean;
  chainId: number | null;
  targetAddress: string | null;
  blindSignReason: "no_clear_signing_context" | "device_rejected_context";
  modelId: "nanoS" | "nanoSP" | "nanoX" | "stax" | "flex" | "europa" | "apexP";
  signerAppVersion: string;
  deviceVersion: string | null;
  ethContext: BlindSigningEventEthContextDto | null;
  platform?: "desktop" | "mobile";
  appVersion?: string;
  platformOS?: string;
  platformVersion?: string;
  liveAppContext?: string | null;
  sessionId?: string | null;
};
