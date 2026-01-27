import { type ContextModuleCalConfig } from "@ledgerhq/context-module";
import { type TransportIdentifier } from "@ledgerhq/device-management-kit";
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import {
  type CalBranch,
  type CalMode,
  type DatasourceProxy,
  initialState,
  type SettingsState,
} from "./schema";

export const settingsSlice = createSlice({
  name: "settings",
  reducerPath: "settings",
  initialState,
  reducers: {
    // Transport settings
    setTransport: (
      state,
      action: PayloadAction<{ transport: TransportIdentifier }>,
    ) => {
      state.transport = action.payload.transport;
    },
    setMockServerUrl: (
      state,
      action: PayloadAction<{ mockServerUrl: string }>,
    ) => {
      state.mockServerUrl = action.payload.mockServerUrl;
    },
    setSpeculosUrl: (state, action: PayloadAction<{ speculosUrl: string }>) => {
      state.speculosUrl = action.payload.speculosUrl;
    },
    setSpeculosVncUrl: (
      state,
      action: PayloadAction<{ speculosVncUrl: string }>,
    ) => {
      state.speculosVncUrl = action.payload.speculosVncUrl;
    },

    // DMK settings
    setAppProvider: (state, action: PayloadAction<{ appProvider: number }>) => {
      state.appProvider = action.payload.appProvider;
    },

    // CAL config
    setCalConfig: (
      state,
      action: PayloadAction<{ calConfig: ContextModuleCalConfig }>,
    ) => {
      state.calConfig = action.payload.calConfig;
    },
    setCalUrl: (state, action: PayloadAction<{ calUrl: string }>) => {
      state.calConfig = { ...state.calConfig, url: action.payload.calUrl };
    },
    setCalMode: (state, action: PayloadAction<{ calMode: CalMode }>) => {
      state.calConfig = { ...state.calConfig, mode: action.payload.calMode };
    },
    setCalBranch: (state, action: PayloadAction<{ calBranch: CalBranch }>) => {
      state.calConfig = {
        ...state.calConfig,
        branch: action.payload.calBranch,
      };
    },
    setOriginToken: (state, action: PayloadAction<{ originToken: string }>) => {
      state.originToken = action.payload.originToken;
    },

    // Web3Checks config
    setWeb3ChecksUrl: (
      state,
      action: PayloadAction<{ web3ChecksUrl: string }>,
    ) => {
      state.web3ChecksConfig = {
        ...state.web3ChecksConfig,
        url: action.payload.web3ChecksUrl,
      };
    },

    // Metadata service config
    setMetadataServiceUrl: (
      state,
      action: PayloadAction<{ metadataServiceUrl: string }>,
    ) => {
      state.metadataServiceConfig = {
        ...state.metadataServiceConfig,
        url: action.payload.metadataServiceUrl,
      };
    },

    // Datasource config
    setDatasourceProxy: (
      state,
      action: PayloadAction<{ datasourceProxy: DatasourceProxy }>,
    ) => {
      state.datasourceConfig = {
        ...state.datasourceConfig,
        proxy: action.payload.datasourceProxy,
      };
    },

    // Hydration action for loading persisted settings
    hydrateSettings: (_state, action: PayloadAction<SettingsState>) => {
      return action.payload;
    },
  },
});

export const {
  setTransport,
  setMockServerUrl,
  setSpeculosUrl,
  setSpeculosVncUrl,
  setAppProvider,
  setCalConfig,
  setCalUrl,
  setCalMode,
  setCalBranch,
  setOriginToken,
  setWeb3ChecksUrl,
  setMetadataServiceUrl,
  setDatasourceProxy,
  hydrateSettings,
} = settingsSlice.actions;

export const settingsReducer = settingsSlice.reducer;
