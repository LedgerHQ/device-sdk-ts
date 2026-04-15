import React, { useEffect, useMemo, useRef } from "react";
import { useSelector } from "react-redux";
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
  type LedgerProofDAError,
  type LedgerProofDAIntermediateValue,
  LKRPUnknownError,
  NobleCryptoService,
} from "@ledgerhq/device-trusted-app-kit-ledger-keyring-protocol";
import { catchError, from, map, of, tap } from "rxjs";
import styled from "styled-components";

import { DeviceActionsList } from "@/components/DeviceActionsView/DeviceActionsList";
import { type DeviceActionProps } from "@/components/DeviceActionsView/DeviceActionTester";
import { Form } from "@/components/Form";
import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { useLedgerKeyringProtocol } from "@/providers/LedgerKeyringProvider";
import { selectSelectedSessionId } from "@/state/sessions/selectors";
import { base64FromBytes, bytesFromBase64, genIdentity } from "@/utils/crypto";
import { parsePermissions } from "@/utils/lkrp-permissions";

export const LedgerKeyringProtocolView: React.FC = () => {
  const dmk = useDmk();

  // NOTE: Use a ref for the sessionId because the reference a given DeviceActionProp will not get updated
  // once the browser navigated to the device action route (Including the reference to the executeDeviceAction function)
  const sessionIdRef = useRef<string>();
  const modelIdRef = useRef<DeviceModelId>();
  {
    const sessionId = useSelector(selectSelectedSessionId);
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
          "Authenticate as an LKRP member. Without a trustchainId, the device will be used. For the web authentication a valid trustchainId and the keyPair of a previouly added member is required. (Valid permissions are: OWNER, CAN_ENCRYPT, CAN_DERIVE, CAN_ADD_BLOCK).",
        executeDeviceAction: ({
          privateKey,
          clientName,
          trustchainId,
          permissions: permissionsExpr,
        }) => {
          if (!app) {
            throw new Error("Ledger Keyring Protocol app not initialized");
          }

          const cryptoService = new NobleCryptoService();
          const keyPair = cryptoService.importKeyPair(
            hexaStringToBuffer(privateKey)!,
            Curve.K256,
          );

          try {
            const authentication = app.authenticate({
              keyPair,
              clientName,
              permissions: parsePermissions(permissionsExpr),
              trustchainId,
              sessionId: sessionIdRef.current,
            });
            return {
              ...authentication,
              observable: authentication.observable.pipe(
                tap((res) => {
                  switch (res.status) {
                    case DeviceActionStatus.Error:
                      console.error(res.error);
                      break;

                    case DeviceActionStatus.Completed: {
                      const { output } = res;
                      const pubkey = keyPair.getPublicKeyToHex();
                      const identity = {
                        jwt: null,
                        trustchain: {
                          rootId: output.trustchainId,
                          walletSyncEncryptionKey: bufferToHexaString(
                            output.encryptionKey,
                          ).slice(2),
                          applicationPath: output.applicationPath,
                        },
                        memberCredentials: {
                          pubkey,
                          privatekey: privateKey.replace(/^0x/, ""),
                        },
                      };
                      console.log({ [pubkey]: identity });
                      break;
                    }
                  }
                }),
              ),
            };
          } catch (error) {
            console.error(error);
            return {
              cancel: () => undefined,
              observable: of({
                status: DeviceActionStatus.Error,
                error: new LKRPUnknownError(String(error)),
              }),
            };
          }
        },
        InputValuesComponent: RowCommandForm as typeof Form<AuthInput>,
        initialValues: {
          ...genIdentity(),
          trustchainId: "",
          permissions: "OWNER & ~CAN_ADD_BLOCK",
        },
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

      {
        title: "Ledger Proof Encrypt",
        description:
          "Encrypt data on the Ledger Proof app. Provide an intent string and UTF-8 data to encrypt.",
        executeDeviceAction: ({ intent, data }) => {
          if (!app) {
            throw new Error("Ledger Keyring Protocol app not initialized");
          }
          const sessionId = sessionIdRef.current;
          if (!sessionId) {
            return {
              cancel: () => undefined,
              observable: of({
                status: DeviceActionStatus.Error,
                error: new LKRPUnknownError("No device session selected"),
              }),
            };
          }
          const blob = new TextEncoder().encode(data);
          const action = app.ledgerProofEncrypt({
            intent,
            blob,
            sessionId,
          });
          return {
            ...action,
            observable: action.observable.pipe(
              map((res) => {
                if (res.status === DeviceActionStatus.Completed) {
                  return {
                    ...res,
                    output: bufferToHexaString(res.output),
                  };
                }
                return res;
              }),
            ),
          };
        },
        initialValues: {
          intent: "identity",
          data: "",
        },
        deviceModelId: modelIdRef.current || DeviceModelId.FLEX,
      } satisfies DeviceActionProps<
        string,
        { intent: string; data: string },
        LedgerProofDAError,
        LedgerProofDAIntermediateValue
      >,

      {
        title: "Ledger Proof Decrypt",
        description:
          "Decrypt data on the Ledger Proof app. Provide a domain (requesting party) and the encrypted data as a hex string.",
        executeDeviceAction: ({ domain, encryptedData: encryptedHex }) => {
          if (!app) {
            throw new Error("Ledger Keyring Protocol app not initialized");
          }
          const sessionId = sessionIdRef.current;
          if (!sessionId) {
            return {
              cancel: () => undefined,
              observable: of({
                status: DeviceActionStatus.Error,
                error: new LKRPUnknownError("No device session selected"),
              }),
            };
          }
          const encryptedData = hexaStringToBuffer(encryptedHex);
          if (!encryptedData) {
            return {
              cancel: () => undefined,
              observable: of({
                status: DeviceActionStatus.Error,
                error: new LKRPUnknownError("Invalid hex string"),
              }),
            };
          }
          const action = app.ledgerProofDecrypt({
            domain,
            encryptedData,
            sessionId,
          });
          return {
            ...action,
            observable: action.observable.pipe(
              map((res) => {
                if (res.status === DeviceActionStatus.Completed) {
                  return {
                    ...res,
                    output: new TextDecoder().decode(res.output),
                  };
                }
                return res;
              }),
            ),
          };
        },
        initialValues: {
          domain: "",
          encryptedData: "",
        },
        deviceModelId: modelIdRef.current || DeviceModelId.FLEX,
      } satisfies DeviceActionProps<
        string,
        { domain: string; encryptedData: string },
        LedgerProofDAError,
        LedgerProofDAIntermediateValue
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
  permissions: string;
};

const RowCommandForm = styled(Form)`
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
