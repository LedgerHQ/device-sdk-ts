import { useSdk } from "@/providers/DeviceSdkProvider";
import { useDeviceSessionsContext } from "@/providers/DeviceSessionsProvider";
import { Grid } from "@ledgerhq/react-ui/index";
import { PageWithHeader } from "../PageWithHeader";
import { useMemo } from "react";
import Command, { CommandProps } from "../CommandsView/Command";
import { useRouter } from "next/navigation";
import { GetAddressCommand } from "@ledgerhq/keyring-eth/internal/app-binder/command/GetAddressCommand.js";

export const KeyringEthView = () => {
  const sdk = useSdk();
  const router = useRouter();

  const {
    state: { selectedId: selectedSessionId },
  } = useDeviceSessionsContext();

  // TODO: replace command with keyring,
  // Commands are internal to the keyring-eth package
  // and users should use the keyring instead

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const commands: CommandProps<any, any>[] = useMemo(
    () =>
      !selectedSessionId
        ? []
        : [
            {
              title: "Get address",
              description: "Get ETH address from the device",
              sendCommand: (args) => {
                const command = new GetAddressCommand(args);
                return sdk.sendCommand({
                  sessionId: selectedSessionId,
                  command,
                });
              },
              initialValues: {
                checkOnDevice: false,
                returnChainCode: false,
                derivationPath: "44'/60'/0'/0/0",
              },
            },
          ],
    [],
  );

  if (!selectedSessionId) {
    router.replace("/");
    return null;
  }

  return (
    <PageWithHeader title="Keyrings">
      <Grid columns={1} rowGap={6} overflowY="scroll">
        {commands.map((command) => (
          <Command
            key={`${command.title}_${command.description}`} // if this is not unique we have another problem
            {...command}
          />
        ))}
      </Grid>
    </PageWithHeader>
  );
};
