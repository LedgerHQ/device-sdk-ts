import {
  type ContextModuleCalConfig,
  type ContextModuleMetadataServiceConfig,
  type ContextModuleWeb3ChecksConfig,
} from "@ledgerhq/context-module";
import { type TransportIdentifier } from "@ledgerhq/device-management-kit";
import { webHidIdentifier } from "@ledgerhq/device-transport-kit-web-hid";

export type SettingsState = {
  // Transport settings (from dmkConfig)
  mockServerUrl: string;
  transport: TransportIdentifier;
  speculosUrl?: string;
  speculosVncUrl?: string;

  // Signer/context module settings (from SignerEthProvider)
  calConfig: ContextModuleCalConfig;
  web3ChecksConfig: ContextModuleWeb3ChecksConfig;
  metadataServiceDomain: ContextModuleMetadataServiceConfig;
  originToken: string;
};

export const initialState: SettingsState = {
  // Transport settings
  mockServerUrl: "http://127.0.0.1:8080/",
  transport: process.env.Dmk_CONFIG_TRANSPORT || webHidIdentifier,
  speculosUrl: undefined,
  speculosVncUrl: undefined,

  // Signer/context module settings
  calConfig: {
    url: "https://crypto-assets-service.api.ledger.com/v1",
    mode: "prod",
    branch: "main",
  },
  web3ChecksConfig: {
    url: "https://web3checks-backend.api.ledger.com/v3",
  },
  metadataServiceDomain: {
    url: "https://nft.api.live.ledger.com",
  },
  originToken: process.env.NEXT_PUBLIC_GATING_TOKEN || "origin-token",
};
