import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  type ContextModuleCalConfig,
  type ContextModuleMetadataServiceConfig,
  type ContextModuleWeb3ChecksConfig,
} from "@ledgerhq/context-module";
import { type TransportIdentifier } from "@ledgerhq/device-management-kit";

import {
  selectCalConfig,
  selectMetadataServiceDomain,
  selectMockServerUrl,
  selectOriginToken,
  selectSpeculosUrl,
  selectSpeculosVncUrl,
  selectTransport,
  selectWeb3ChecksConfig,
} from "./selectors";
import {
  setCalConfig,
  setMetadataServiceDomain,
  setMockServerUrl,
  setOriginToken,
  setTransport,
  setWeb3ChecksConfig,
} from "./slice";

// Transport settings hooks
export function useTransport() {
  const transport = useSelector(selectTransport);
  return transport;
}

export function useMockServerUrl() {
  const mockServerUrl = useSelector(selectMockServerUrl);
  return mockServerUrl;
}

export function useSpeculosUrl() {
  const speculosUrl = useSelector(selectSpeculosUrl);
  return speculosUrl;
}

export function useSpeculosVncUrl() {
  const speculosVncUrl = useSelector(selectSpeculosVncUrl);
  return speculosVncUrl;
}

export function useSetTransport() {
  const dispatch = useDispatch();
  return useCallback(
    (
      transport: TransportIdentifier,
      speculosUrl?: string,
      speculosVncUrl?: string,
    ) => {
      dispatch(setTransport({ transport, speculosUrl, speculosVncUrl }));
    },
    [dispatch],
  );
}

export function useSetMockServerUrl() {
  const dispatch = useDispatch();
  return useCallback(
    (mockServerUrl: string) => {
      dispatch(setMockServerUrl({ mockServerUrl }));
    },
    [dispatch],
  );
}

// Signer/context module settings hooks
export function useCalConfig() {
  const calConfig = useSelector(selectCalConfig);
  const dispatch = useDispatch();
  const setCalConfigFn = useCallback(
    (newCalConfig: ContextModuleCalConfig) => {
      dispatch(setCalConfig({ calConfig: newCalConfig }));
    },
    [dispatch],
  );
  return { calConfig, setCalConfig: setCalConfigFn };
}

export function useWeb3ChecksConfig() {
  const web3ChecksConfig = useSelector(selectWeb3ChecksConfig);
  const dispatch = useDispatch();
  const setWeb3ChecksConfigFn = useCallback(
    (newWeb3ChecksConfig: ContextModuleWeb3ChecksConfig) => {
      dispatch(setWeb3ChecksConfig({ web3ChecksConfig: newWeb3ChecksConfig }));
    },
    [dispatch],
  );
  return { web3ChecksConfig, setWeb3ChecksConfig: setWeb3ChecksConfigFn };
}

export function useMetadataServiceConfig() {
  const metadataServiceDomain = useSelector(selectMetadataServiceDomain);
  const dispatch = useDispatch();
  const setMetadataServiceConfigFn = useCallback(
    (newMetadataServiceDomain: ContextModuleMetadataServiceConfig) => {
      dispatch(
        setMetadataServiceDomain({
          metadataServiceDomain: newMetadataServiceDomain,
        }),
      );
    },
    [dispatch],
  );
  return {
    metadataServiceDomain,
    setMetadataServiceConfig: setMetadataServiceConfigFn,
  };
}

export function useOriginToken() {
  const originToken = useSelector(selectOriginToken);
  const dispatch = useDispatch();
  const setOriginTokenFn = useCallback(
    (newOriginToken: string) => {
      dispatch(setOriginToken({ originToken: newOriginToken }));
    },
    [dispatch],
  );
  return { originToken, setOriginToken: setOriginTokenFn };
}
