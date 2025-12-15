import {
  type ContextModuleCalConfig,
  type ContextModuleMetadataServiceConfig,
  type ContextModuleWeb3ChecksConfig,
} from "@ledgerhq/context-module";
import { type TransportIdentifier } from "@ledgerhq/device-management-kit";
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { initialState } from "./schema";

export const settingsSlice = createSlice({
  name: "settings",
  reducerPath: "settings",
  initialState,
  reducers: {
    // Transport settings
    setTransport: (
      state,
      action: PayloadAction<{
        transport: TransportIdentifier;
        speculosUrl?: string;
        speculosVncUrl?: string;
      }>,
    ) => {
      state.transport = action.payload.transport;
      state.speculosUrl = action.payload.speculosUrl;
      state.speculosVncUrl = action.payload.speculosVncUrl;
    },
    setMockServerUrl: (
      state,
      action: PayloadAction<{ mockServerUrl: string }>,
    ) => {
      state.mockServerUrl = action.payload.mockServerUrl;
    },

    // Signer/context module settings
    setCalConfig: (
      state,
      action: PayloadAction<{ calConfig: ContextModuleCalConfig }>,
    ) => {
      state.calConfig = action.payload.calConfig;
    },
    setWeb3ChecksConfig: (
      state,
      action: PayloadAction<{
        web3ChecksConfig: ContextModuleWeb3ChecksConfig;
      }>,
    ) => {
      state.web3ChecksConfig = action.payload.web3ChecksConfig;
    },
    setMetadataServiceDomain: (
      state,
      action: PayloadAction<{
        metadataServiceDomain: ContextModuleMetadataServiceConfig;
      }>,
    ) => {
      state.metadataServiceDomain = action.payload.metadataServiceDomain;
    },
    setOriginToken: (state, action: PayloadAction<{ originToken: string }>) => {
      state.originToken = action.payload.originToken;
    },
  },
});

export const {
  setTransport,
  setMockServerUrl,
  setCalConfig,
  setWeb3ChecksConfig,
  setMetadataServiceDomain,
  setOriginToken,
} = settingsSlice.actions;

export const settingsReducer = settingsSlice.reducer;
