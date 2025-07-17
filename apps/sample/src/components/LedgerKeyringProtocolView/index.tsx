import React, { useMemo } from "react";
import {
  type AuthenticateDAError,
  type AuthenticateDAIntermediateValue,
  type AuthenticateDAOutput,
  type JWT,
} from "@ledgerhq/device-trusted-app-kit-ledger-keyring-protocol";

import { DeviceActionsList } from "@/components/DeviceActionsView/DeviceActionsList";
import { type DeviceActionProps } from "@/components/DeviceActionsView/DeviceActionTester";
import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { useLedgerKeyringProtocol } from "@/providers/LedgerKeyringProvider";
import { getPublicKey, hexToBytes, randomPrivateKey } from "@/utils/crypto";

export const LedgerKeyringProtocolView: React.FC<{ sessionId: string }> = ({
  sessionId,
}) => {
  const dmk = useDmk();
  const app = useLedgerKeyringProtocol();

  const deviceModelId = dmk.getConnectedDevice({
    sessionId,
  }).modelId;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deviceActions: DeviceActionProps<any, any, any, any>[] = useMemo(
    () => [
      {
        title: "Authenticate",
        description:
          "Authenticate as an LKRP member. Without a trustchainId, the device will be used. For the web authentication a valid trustchainId and the keypair of a previouly added member is required.",
        executeDeviceAction: ({
          privateKey,
          applicationId,
          trustchainId,
          jwt: serializedJwt,
        }) => {
          if (!app) {
            throw new Error("Ledger Keyring Protocol app not initialized");
          }
          const jwt = JSON.parse(serializedJwt) as JWT;
          return app.authenticate(
            {
              publicKey: getPublicKey(privateKey),
              privateKey: hexToBytes(privateKey),
            },
            applicationId,
            trustchainId || undefined,
            jwt ?? undefined,
          );
        },
        initialValues: {
          privateKey: randomPrivateKey(),
          applicationId: 16,
          trustchainId: "",
          jwt: "null",
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        AuthenticateDAOutput,
        {
          privateKey: string;
          applicationId: number;
          trustchainId: string;
          jwt: string;
        },
        AuthenticateDAError,
        AuthenticateDAIntermediateValue
      >,
    ],
    [app, deviceModelId],
  );

  return (
    <DeviceActionsList
      title="Ledger Keyring Protocol"
      deviceActions={deviceActions}
    />
  );
};
