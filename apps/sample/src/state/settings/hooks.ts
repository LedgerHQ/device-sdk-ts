import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { type TransportIdentifier } from "@ledgerhq/device-management-kit";

import { type CalBranch, type CalMode } from "./schema";
import {
  selectAppProvider,
  selectCalBranch,
  selectCalConfig,
  selectCalMode,
  selectCalUrl,
  selectMetadataServiceConfig,
  selectMetadataServiceUrl,
  selectMockServerUrl,
  selectOriginToken,
  selectSpeculosUrl,
  selectSpeculosVncUrl,
  selectTransport,
  selectWeb3ChecksConfig,
  selectWeb3ChecksUrl,
} from "./selectors";
import {
  setAppProvider,
  setCalBranch,
  setCalMode,
  setCalUrl,
  setMetadataServiceUrl,
  setMockServerUrl,
  setOriginToken,
  setSpeculosUrl,
  setSpeculosVncUrl,
  setTransport,
  setWeb3ChecksUrl,
} from "./slice";

export function useTransport() {
  return useSelector(selectTransport);
}

export function useSetTransport() {
  const dispatch = useDispatch();
  return useCallback(
    (transport: TransportIdentifier) => {
      dispatch(setTransport({ transport }));
    },
    [dispatch],
  );
}

export function useMockServerUrl() {
  return useSelector(selectMockServerUrl);
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

export function useSpeculosUrl() {
  return useSelector(selectSpeculosUrl);
}

export function useSetSpeculosUrl() {
  const dispatch = useDispatch();
  return useCallback(
    (speculosUrl: string) => {
      dispatch(setSpeculosUrl({ speculosUrl }));
    },
    [dispatch],
  );
}

export function useSpeculosVncUrl() {
  return useSelector(selectSpeculosVncUrl);
}

export function useSetSpeculosVncUrl() {
  const dispatch = useDispatch();
  return useCallback(
    (speculosVncUrl: string) => {
      dispatch(setSpeculosVncUrl({ speculosVncUrl }));
    },
    [dispatch],
  );
}

// DMK settings hooks
export function useAppProvider() {
  return useSelector(selectAppProvider);
}

export function useSetAppProvider() {
  const dispatch = useDispatch();
  return useCallback(
    (appProvider: number) => {
      dispatch(setAppProvider({ appProvider }));
    },
    [dispatch],
  );
}

export function useCalConfig() {
  return useSelector(selectCalConfig);
}

export function useCalUrl() {
  return useSelector(selectCalUrl);
}

export function useSetCalUrl() {
  const dispatch = useDispatch();
  return useCallback(
    (calUrl: string) => {
      dispatch(setCalUrl({ calUrl }));
    },
    [dispatch],
  );
}

export function useCalMode() {
  return useSelector(selectCalMode);
}

export function useSetCalMode() {
  const dispatch = useDispatch();
  return useCallback(
    (calMode: CalMode) => {
      dispatch(setCalMode({ calMode }));
    },
    [dispatch],
  );
}

export function useCalBranch() {
  return useSelector(selectCalBranch);
}

export function useSetCalBranch() {
  const dispatch = useDispatch();
  return useCallback(
    (calBranch: CalBranch) => {
      dispatch(setCalBranch({ calBranch }));
    },
    [dispatch],
  );
}

export function useOriginToken() {
  return useSelector(selectOriginToken);
}

export function useSetOriginToken() {
  const dispatch = useDispatch();
  return useCallback(
    (originToken: string) => {
      dispatch(setOriginToken({ originToken }));
    },
    [dispatch],
  );
}

export function useWeb3ChecksConfig() {
  return useSelector(selectWeb3ChecksConfig);
}

export function useWeb3ChecksUrl() {
  return useSelector(selectWeb3ChecksUrl);
}

export function useSetWeb3ChecksUrl() {
  const dispatch = useDispatch();
  return useCallback(
    (web3ChecksUrl: string) => {
      dispatch(setWeb3ChecksUrl({ web3ChecksUrl }));
    },
    [dispatch],
  );
}

export function useMetadataServiceConfig() {
  return useSelector(selectMetadataServiceConfig);
}

export function useMetadataServiceUrl() {
  return useSelector(selectMetadataServiceUrl);
}

export function useSetMetadataServiceUrl() {
  const dispatch = useDispatch();
  return useCallback(
    (metadataServiceUrl: string) => {
      dispatch(setMetadataServiceUrl({ metadataServiceUrl }));
    },
    [dispatch],
  );
}
