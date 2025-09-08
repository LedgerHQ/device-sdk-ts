import { type DeviceModelId } from "@ledgerhq/device-management-kit";

import { type ContextFieldLoaderKind } from "@/shared/domain/ContextFieldLoader";

export type TransactionFieldContext<
  T extends ContextFieldLoaderKind = ContextFieldLoaderKind,
> = T extends ContextFieldLoaderKind.TOKEN
  ? {
      kind: ContextFieldLoaderKind.TOKEN;
      chainId: number;
      address: string;
    }
  : T extends ContextFieldLoaderKind.NFT
    ? {
        kind: ContextFieldLoaderKind.NFT;
        chainId: number;
        address: string;
      }
    : T extends ContextFieldLoaderKind.TRUSTED_NAME
      ? {
          kind: ContextFieldLoaderKind.TRUSTED_NAME;
          chainId: number;
          address: string;
          challenge: string;
          types: string[];
          sources: string[];
        }
      : T extends ContextFieldLoaderKind.PROXY_DELEGATE_CALL
        ? {
            kind: ContextFieldLoaderKind.PROXY_DELEGATE_CALL;
            chainId: number;
            proxyAddress: string;
            calldata: string;
            challenge: string;
            deviceModelId: DeviceModelId;
          }
        : never;
