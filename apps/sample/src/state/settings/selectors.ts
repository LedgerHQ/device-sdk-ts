import { type RootState } from "@/state/store";

// Transport settings selectors
export const selectTransport = (state: RootState) => state.settings.transport;

export const selectMockServerUrl = (state: RootState) =>
  state.settings.mockServerUrl;

export const selectSpeculosUrl = (state: RootState) =>
  state.settings.speculosUrl;

export const selectSpeculosVncUrl = (state: RootState) =>
  state.settings.speculosVncUrl;

// Signer/context module settings selectors
export const selectCalConfig = (state: RootState) => state.settings.calConfig;

export const selectWeb3ChecksConfig = (state: RootState) =>
  state.settings.web3ChecksConfig;

export const selectMetadataServiceDomain = (state: RootState) =>
  state.settings.metadataServiceDomain;

export const selectOriginToken = (state: RootState) =>
  state.settings.originToken;
