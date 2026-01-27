import { type RootState } from "@/state/store";

// Transport settings selectors
export const selectTransport = (state: RootState) => state.settings.transport;
export const selectMockServerUrl = (state: RootState) =>
  state.settings.mockServerUrl;
export const selectSpeculosUrl = (state: RootState) =>
  state.settings.speculosUrl;
export const selectSpeculosVncUrl = (state: RootState) =>
  state.settings.speculosVncUrl;

// DMK settings selectors
export const selectAppProvider = (state: RootState) =>
  state.settings.appProvider;

// CAL config selectors
export const selectCalConfig = (state: RootState) => state.settings.calConfig;
export const selectCalUrl = (state: RootState) => state.settings.calConfig.url;
export const selectCalMode = (state: RootState) =>
  state.settings.calConfig.mode;
export const selectCalBranch = (state: RootState) =>
  state.settings.calConfig.branch;
export const selectOriginToken = (state: RootState) =>
  state.settings.originToken;

// Web3Checks selectors
export const selectWeb3ChecksConfig = (state: RootState) =>
  state.settings.web3ChecksConfig;
export const selectWeb3ChecksUrl = (state: RootState) =>
  state.settings.web3ChecksConfig.url;

// Metadata service selectors
export const selectMetadataServiceConfig = (state: RootState) =>
  state.settings.metadataServiceConfig;
export const selectMetadataServiceUrl = (state: RootState) =>
  state.settings.metadataServiceConfig.url;

// Datasource config selectors
export const selectDatasourceConfig = (state: RootState) =>
  state.settings.datasourceConfig;
export const selectDatasourceProxy = (state: RootState) =>
  state.settings.datasourceConfig.proxy;
