import React, { useMemo } from "react";
import {
  type GetAddressDAError,
  type GetAddressDAIntermediateValue,
  type GetAddressDAOutput,
  type GetAppConfigDAError,
  type GetAppConfigDAIntermediateValue,
  type GetAppConfigDAOutput,
  type GetViewKeyDAError,
  type GetViewKeyDAIntermediateValue,
  type GetViewKeyDAOutput,
  type SignFeeIntentDAError,
  type SignFeeIntentDAIntermediateValue,
  type SignFeeIntentDAOutput,
  type SignNestedCallDAError,
  type SignNestedCallDAIntermediateValue,
  type SignNestedCallDAOutput,
  type SignRootIntentDAError,
  type SignRootIntentDAIntermediateValue,
  type SignRootIntentDAOutput,
} from "@ledgerhq/device-signer-kit-aleo";

import { DeviceActionsList } from "@/components/DeviceActionsView/DeviceActionsList";
import { type DeviceActionProps } from "@/components/DeviceActionsView/DeviceActionTester";
import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { useSignerAleo } from "@/providers/SignerAleoProvider";

export const SignerAleoView: React.FC<{ sessionId: string }> = ({
  sessionId,
}) => {
  const dmk = useDmk();
  const signer = useSignerAleo();

  const deviceModelId = dmk.getConnectedDevice({
    sessionId,
  }).modelId;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deviceActions: DeviceActionProps<any, any, any, any>[] = useMemo(
    () => [
      {
        title: "Get App Config",
        description: "Get the app configuration from the device",
        executeDeviceAction: () => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }
          return signer.getAppConfig();
        },
        initialValues: {},
        deviceModelId,
      } satisfies DeviceActionProps<
        GetAppConfigDAOutput,
        Record<string, never>,
        GetAppConfigDAError,
        GetAppConfigDAIntermediateValue
      >,
      {
        title: "Get Address",
        description: "Get an address from the device",
        executeDeviceAction: ({
          derivationPath,
          checkOnDevice,
          skipOpenApp,
        }) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }
          return signer.getAddress(derivationPath, {
            checkOnDevice,
            skipOpenApp,
          });
        },
        initialValues: {
          derivationPath: "44'/683'/0'/0'",
          checkOnDevice: false,
          skipOpenApp: false,
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        GetAddressDAOutput,
        {
          derivationPath: string;
          checkOnDevice?: boolean;
          skipOpenApp?: boolean;
        },
        GetAddressDAError,
        GetAddressDAIntermediateValue
      >,
      {
        title: "Get View Key",
        description: "Get the view key from the device",
        executeDeviceAction: ({ derivationPath, skipOpenApp }) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }
          return signer.getViewKey(derivationPath, {
            skipOpenApp,
          });
        },
        initialValues: {
          derivationPath: "44'/683'/0",
          skipOpenApp: false,
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        GetViewKeyDAOutput,
        {
          derivationPath: string;
          skipOpenApp?: boolean;
        },
        GetViewKeyDAError,
        GetViewKeyDAIntermediateValue
      >,
      {
        title: "Sign Root Intent",
        description: "Sign a root intent with the device",
        executeDeviceAction: ({
          derivationPath,
          rootIntent,
          skipOpenApp,
          tokenInternalId,
          programName,
        }) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }
          // Convert hex string to Uint8Array
          const rootIntentBytes = rootIntent.startsWith("0x")
            ? new Uint8Array(
                rootIntent
                  .slice(2)
                  .match(/.{1,2}/g)
                  ?.map((byte) => parseInt(byte, 16)) ?? [],
              )
            : new Uint8Array(
                rootIntent
                  .match(/.{1,2}/g)
                  ?.map((byte) => parseInt(byte, 16)) ?? [],
              );
          console.log("tokenInternalId", tokenInternalId);
          return signer.signRootIntent(derivationPath, rootIntentBytes, {
            skipOpenApp,
            tokenInternalId: tokenInternalId || undefined,
            programName: programName || undefined,
          });
        },
        initialValues: {
          derivationPath: "44'/683'/0'/0'",
          rootIntent:
            "01012802010181b0040000000081b1040000000081b20b6665655f7072697661746581b30c637265646974732e616c656f81b482016901012902010181c302000181b5136c6467626174636865725f7032382e616c656f81b6127472616e736665725f707269766174655f3281b7010481b9010481b860d5f4b9312020d52c6752cb927e00771b300e8742e7cbe2cffe79a2a9f1641e03f1020000b6a58dc9bd8dc99591a5d1cd0503100019000000000000806381fe03232753113751635f57729543c73e2ab3641901f57fec18b1e560b28b8000000081b9010481b860d5f4b9312020d52c6752cb927e00771b300e8742e7cbe2cffe79a2a9f1641e03f1020000b6a58dc9bd8dc99591a5d1cd0503100019000000000000c0eed4b40239bab0f49f52a8a88613dc6ea6aec32d2d23df9a005edf7d940ecfb98000000081b90302000081b820161c02624f57f184f394f3452bb3be751a1163c19a3ef81a570d0ebd33f3980d81b90302000c81b808c80000000000000081ba010281c420e9fb1007c069e11dda4a4c3f6e1d5a8c6fcbfb0a1f556ff629719f095902e107",
          skipOpenApp: false,
          tokenInternalId: "solana/spl/00000000000000000000000000_elm7r7k1zazx3up6gus1p2s3mon845rdvp1ajon9hfep",
          programName: "ELm7r7k1ZAZX3up6gus1p2s3mon845rdVP1aJoN9HfEP",
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        SignRootIntentDAOutput,
        {
          derivationPath: string;
          rootIntent: string;
          skipOpenApp?: boolean;
          tokenInternalId?: string;
          programName?: string;
        },
        SignRootIntentDAError,
        SignRootIntentDAIntermediateValue
      >,
      {
        title: "Sign Fee Intent",
        description: "Sign a fee intent with the device",
        executeDeviceAction: ({ feeIntent, skipOpenApp }) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }
          // Convert hex string to Uint8Array
          const feeIntentBytes = feeIntent.startsWith("0x")
            ? new Uint8Array(
                feeIntent
                  .slice(2)
                  .match(/.{1,2}/g)
                  ?.map((byte) => parseInt(byte, 16)) ?? [],
              )
            : new Uint8Array(
                feeIntent.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) ??
                  [],
              );
          return signer.signFeeIntent(feeIntentBytes, {
            skipOpenApp,
          });
        },
        initialValues: {
          feeIntent: "",
          skipOpenApp: false,
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        SignFeeIntentDAOutput,
        {
          feeIntent: string;
          skipOpenApp?: boolean;
        },
        SignFeeIntentDAError,
        SignFeeIntentDAIntermediateValue
      >,
      {
        title: "Sign Nested Call",
        description: "Sign a nested call with the device",
        executeDeviceAction: ({ nestedCallRequest, skipOpenApp }) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }
          // Convert hex string to Uint8Array
          const nestedCallRequestBytes = nestedCallRequest.startsWith("0x")
            ? new Uint8Array(
                nestedCallRequest
                  .slice(2)
                  .match(/.{1,2}/g)
                  ?.map((byte) => Number.parseInt(byte, 16)) ?? [],
              )
            : new Uint8Array(
                nestedCallRequest
                  .match(/.{1,2}/g)
                  ?.map((byte) => Number.parseInt(byte, 16)) ?? [],
              );
          return signer.signNestedCall(nestedCallRequestBytes, {
            skipOpenApp,
          });
        },
        initialValues: {
          nestedCallRequest: "",
          skipOpenApp: false,
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        SignNestedCallDAOutput,
        {
          nestedCallRequest: string;
          skipOpenApp?: boolean;
        },
        SignNestedCallDAError,
        SignNestedCallDAIntermediateValue
      >,
    ],
    [deviceModelId, signer],
  );

  return (
    <DeviceActionsList title="Signer Aleo" deviceActions={deviceActions} />
  );
};
