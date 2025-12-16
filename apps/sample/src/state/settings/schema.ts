import {
  type ContextModuleCalBranch,
  type ContextModuleCalConfig,
  type ContextModuleCalMode,
  type ContextModuleMetadataServiceConfig,
  type ContextModuleWeb3ChecksConfig,
} from "@ledgerhq/context-module";
import { type TransportIdentifier } from "@ledgerhq/device-management-kit";
import { webHidIdentifier } from "@ledgerhq/device-transport-kit-web-hid";

import { DEFAULT_SPECULOS_URL, DEFAULT_SPECULOS_VNC_URL } from "@/utils/const";

export type CalMode = ContextModuleCalMode;
export type CalBranch = ContextModuleCalBranch;

export type SettingsState = {
  // Transport settings
  mockServerUrl: string;
  transport: TransportIdentifier;
  speculosUrl: string;
  speculosVncUrl: string;

  // DMK settings
  appProvider: number;

  // Context module config
  calConfig: ContextModuleCalConfig;
  web3ChecksConfig: ContextModuleWeb3ChecksConfig;
  metadataServiceConfig: ContextModuleMetadataServiceConfig;
  originToken: string;
};

export const initialState: SettingsState = {
  // Transport settings
  mockServerUrl: "http://127.0.0.1:8080/",
  transport: process.env.Dmk_CONFIG_TRANSPORT || webHidIdentifier,
  speculosUrl: DEFAULT_SPECULOS_URL,
  speculosVncUrl: DEFAULT_SPECULOS_VNC_URL,

  // DMK settings
  appProvider: 1,

  // Context module config objects
  calConfig: {
    url: "https://crypto-assets-service.api.ledger.com/v1",
    mode: "prod",
    branch: "main",
  },
  web3ChecksConfig: {
    url: "https://web3checks-backend.api.ledger.com/v3",
  },
  metadataServiceConfig: {
    url: "https://nft.api.live.ledger.com",
  },
  originToken: process.env.NEXT_PUBLIC_GATING_TOKEN || "origin-token",
};
