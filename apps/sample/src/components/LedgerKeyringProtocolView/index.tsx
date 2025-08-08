import React, { useMemo, useRef } from "react";
import {
  DeviceActionStatus,
  type DmkError,
  type ExecuteDeviceActionReturnType,
} from "@ledgerhq/device-management-kit";
import {
  type AuthenticateDAError,
  type AuthenticateDAIntermediateValue,
  type AuthenticateDAOutput,
  KeypairFromBytes,
  Permissions,
} from "@ledgerhq/device-trusted-app-kit-ledger-keyring-protocol";
import { of } from "rxjs";
import styled from "styled-components";

import { CommandForm } from "@/components//CommandsView/CommandForm";
import { DeviceActionsList } from "@/components/DeviceActionsView/DeviceActionsList";
import { type DeviceActionProps } from "@/components/DeviceActionsView/DeviceActionTester";
import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { useLedgerKeyringProtocol } from "@/providers/LedgerKeyringProvider";
import { bytesToHex, genIdentity, hexToBytes } from "@/utils/crypto";

export const LedgerKeyringProtocolView: React.FC<{ sessionId: string }> = ({
  sessionId,
}) => {
  const dmk = useDmk();
  const app = useLedgerKeyringProtocol();

  const deviceModelId = dmk.getConnectedDevice({
    sessionId,
  }).modelId;

  const encryptionKeyRef = useRef("");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deviceActions: DeviceActionProps<any, any, any, any>[] = useMemo(
    () => [
      {
        title: "Authenticate",
        description:
          "Authenticate as an LKRP member. Without a trustchainId, the device will be used. For the web authentication a valid trustchainId and the keypair of a previouly added member is required.",
        executeDeviceAction: ({ privateKey, clientName, trustchainId }) => {
          if (!app) {
            throw new Error("Ledger Keyring Protocol app not initialized");
          }
          return app.authenticate(
            new KeypairFromBytes(hexToBytes(privateKey)),
            clientName,
            Permissions.OWNER,
            trustchainId || undefined,
          );
        },
        InputValuesComponent: RowCommandForm as typeof CommandForm<AuthInput>,
        initialValues: { ...genIdentity(), trustchainId: "" },
        deviceModelId,
      } satisfies DeviceActionProps<
        AuthenticateDAOutput,
        AuthInput,
        AuthenticateDAError,
        AuthenticateDAIntermediateValue
      >,

      {
        title: "Encrypt",
        description:
          "Encrypt a UTF8 encoded message, using the extended private key from the trustchain.",
        executeDeviceAction: ({ encryptionKey, data }) => {
          if (!app) {
            throw new Error("Ledger Keyring Protocol app not initialized");
          }
          encryptionKeyRef.current = encryptionKey;
          return fnToDAReturn(() =>
            bytesToHex(
              app.encryptData(
                hexToBytes(encryptionKey),
                new TextEncoder().encode(data),
              ),
            ),
          );
        },
        initialValues: {
          get encryptionKey() {
            return encryptionKeyRef.current || "";
          },
          data: "",
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        string,
        { encryptionKey: string; data: string },
        DmkError,
        never
      >,

      {
        title: "Decrypt",
        description:
          "Decrypt an encrypted UTF8 encoded message, using the extended private key from the trustchain.",
        executeDeviceAction: ({ encryptionKey, data }) => {
          if (!app) {
            throw new Error("Ledger Keyring Protocol app not initialized");
          }
          encryptionKeyRef.current = encryptionKey;
          return fnToDAReturn(() =>
            new TextDecoder().decode(
              app.decryptData(hexToBytes(encryptionKey), hexToBytes(data)),
            ),
          );
        },
        initialValues: {
          get encryptionKey() {
            return encryptionKeyRef.current || "";
          },
          data: "",
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        string,
        { encryptionKey: string; data: string },
        DmkError,
        never
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

type AuthInput = {
  privateKey: string;
  clientName: string;
  trustchainId: string;
};

const RowCommandForm = styled(CommandForm)`
  flex-direction: row;
`;

function fnToDAReturn<Output, Error>(
  fn: () => Output,
): ExecuteDeviceActionReturnType<Output, Error, never> {
  let observable: ExecuteDeviceActionReturnType<
    Output,
    Error,
    never
  >["observable"];
  try {
    observable = of({
      status: DeviceActionStatus.Completed,
      output: fn(),
    });
  } catch (error) {
    observable = of({
      status: DeviceActionStatus.Error,
      error: error as Error,
    });
  }
  return {
    observable,
    cancel: () => undefined, // Can't cancel a synchronous function
  };
}
