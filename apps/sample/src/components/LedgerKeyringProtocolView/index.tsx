import React, { useMemo } from "react";
import {
  type AuthenticateDAError,
  type AuthenticateDAIntermediateValue,
  type AuthenticateDAOutput,
  KeypairFromBytes,
  Permissions,
} from "@ledgerhq/device-trusted-app-kit-ledger-keyring-protocol";
import styled from "styled-components";

import { CommandForm } from "@/components//CommandsView/CommandForm";
import { DeviceActionsList } from "@/components/DeviceActionsView/DeviceActionsList";
import { type DeviceActionProps } from "@/components/DeviceActionsView/DeviceActionTester";
import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { useLedgerKeyringProtocol } from "@/providers/LedgerKeyringProvider";
import { genIdentity, hexToBytes } from "@/utils/crypto";

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
        InputValuesComponent: RowCommandForm,
        initialValues: { ...genIdentity(), trustchainId: "" },
        deviceModelId,
      } satisfies DeviceActionProps<
        AuthenticateDAOutput,
        AuthInput,
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

type AuthInput = {
  privateKey: string;
  clientName: string;
  trustchainId: string;
};

const RowCommandForm = styled(CommandForm<AuthInput>)`
  direction: row;
`;
