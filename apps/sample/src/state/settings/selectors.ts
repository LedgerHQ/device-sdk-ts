import { createSelector } from "@reduxjs/toolkit";

import { type RootState } from "@/state/store";

import { type TransportConfig } from "./schema";

// Transport settings selectors
export const selectTransportType = (state: RootState) =>
  state.settings.transportType;
export const selectMockServerUrl = (state: RootState) =>
  state.settings.mockServerUrl;
export const selectSpeculosUrl = (state: RootState) =>
  state.settings.speculosUrl;
export const selectSpeculosVncUrl = (state: RootState) =>
  state.settings.speculosVncUrl;

// Derived transport config selector (memoized to avoid creating new objects on every render)
export const selectTransportConfig = createSelector(
  [selectTransportType, selectMockServerUrl, selectSpeculosUrl],
  (transportType, mockServerUrl, speculosUrl): TransportConfig => {
    switch (transportType) {
      case "speculos":
        return { type: "speculos", url: speculosUrl };
      case "mockserver":
        return { type: "mockserver", url: mockServerUrl };
      default:
        return { type: "default" };
    }
  },
);

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
