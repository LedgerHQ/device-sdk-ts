import React, { useEffect, useMemo, useRef } from "react";
import {
  bufferToHexaString,
  type DeviceActionState,
  DeviceActionStatus,
  DeviceModelId,
  type DmkError,
  type ExecuteDeviceActionReturnType,
  hexaStringToBuffer,
} from "@ledgerhq/device-management-kit";
import {
  type AuthenticateDAError,
  type AuthenticateDAIntermediateValue,
  type AuthenticateDAOutput,
  Curve,
  NobleCryptoService,
  Permissions,
} from "@ledgerhq/device-trusted-app-kit-ledger-keyring-protocol";
import { catchError, from, map, of } from "rxjs";
import styled from "styled-components";

import { CommandForm } from "@/components//CommandsView/CommandForm";
import { DeviceActionsList } from "@/components/DeviceActionsView/DeviceActionsList";
import { type DeviceActionProps } from "@/components/DeviceActionsView/DeviceActionTester";
import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { useDeviceSessionsContext } from "@/providers/DeviceSessionsProvider";
import { useLedgerKeyringProtocol } from "@/providers/LedgerKeyringProvider";
import { base64FromBytes, bytesFromBase64, genIdentity } from "@/utils/crypto";

export const LedgerKeyringProtocolView: React.FC = () => {
  const dmk = useDmk();

  // NOTE: Use a ref for the sessionId because the reference a given DeviceActionProp will not get updated
  // once the browser navigated to the device action route (Including the reference to the executeDeviceAction function)
  const sessionIdRef = useRef<string>();
  const modelIdRef = useRef<DeviceModelId>();
  {
    const {
      state: { selectedId: sessionId },
    } = useDeviceSessionsContext();
    useEffect(() => {
      if (!sessionId) return;

      sessionIdRef.current = sessionId;

      modelIdRef.current = dmk.getConnectedDevice({ sessionId }).modelId;
    }, [sessionId, dmk]);
  }

  // NOTE: Use a ref here for the same reason as above.
  const encryptionKeyRef = useRef("");

  const app = useLedgerKeyringProtocol();

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
          const cryptoService = new NobleCryptoService();
          return app.authenticate({
            keypair: cryptoService.importKeyPair(
              hexaStringToBuffer(privateKey)!,
              Curve.K256,
            ),
            clientName,
            permissions: Permissions.OWNER,
            trustchainId,
            sessionId: sessionIdRef.current,
          });
        },
        InputValuesComponent: RowCommandForm as typeof CommandForm<AuthInput>,
        initialValues: { ...genIdentity(), trustchainId: "" },
        deviceModelId: modelIdRef.current || DeviceModelId.FLEX,
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
          return fnToDAReturn(async () =>
            bufferToHexaString(
              await app.encryptData(
                hexaStringToBuffer(encryptionKey)!,
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
        deviceModelId: modelIdRef.current || DeviceModelId.FLEX,
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
          return fnToDAReturn(async () =>
            new TextDecoder().decode(
              await app.decryptData(
                hexaStringToBuffer(encryptionKey)!,
                hexaStringToBuffer(data)!,
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
        deviceModelId: modelIdRef.current || DeviceModelId.FLEX,
      } satisfies DeviceActionProps<
        string,
        { encryptionKey: string; data: string },
        DmkError,
        never
      >,

      {
        title: "Decrypt Base64",
        description:
          "Decrypt arbitrary base64 encoded binary data, using the extended private key from the trustchain.",
        executeDeviceAction: ({ encryptionKey, data }) => {
          if (!app) {
            throw new Error("Ledger Keyring Protocol app not initialized");
          }
          encryptionKeyRef.current = encryptionKey;
          return fnToDAReturn(async () =>
            base64FromBytes(
              await app.decryptData(
                hexaStringToBuffer(encryptionKey)!,
                bytesFromBase64(data),
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
        deviceModelId: modelIdRef.current || DeviceModelId.FLEX,
      } satisfies DeviceActionProps<
        string,
        { encryptionKey: string; data: string },
        DmkError,
        never
      >,
    ],
    [app],
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
  fn: () => Promise<Output>,
): ExecuteDeviceActionReturnType<Output, Error, never> {
  const observable = from(fn()).pipe(
    map(
      (output: Output) =>
        ({
          status: DeviceActionStatus.Completed,
          output,
        }) satisfies DeviceActionState<Output, Error, never>,
    ),
    catchError((error: Error) =>
      of({
        status: DeviceActionStatus.Error,
        error,
      } satisfies DeviceActionState<Output, Error, never>),
    ),
  );

  return {
    observable,
    cancel: () => undefined,
  };
}
