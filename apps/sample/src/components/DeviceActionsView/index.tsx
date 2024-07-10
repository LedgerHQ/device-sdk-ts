import { useSdk } from "@/providers/DeviceSdkProvider";
import { useDeviceSessionsContext } from "@/providers/DeviceSessionsProvider";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { PageWithHeader } from "@/components/PageWithHeader";
import { Grid } from "@ledgerhq/react-ui";
import { DeviceAction, DeviceActionProps } from "./DeviceAction";
import {
  OpenAppDeviceAction,
  OpenAppDAError,
  OpenAppDAInput,
  OpenAppDAIntermediateValue,
  OpenAppDAOutput,
  GetDeviceStatusDeviceAction,
  GetDeviceStatusDAInput,
  GetDeviceStatusDAError,
  GetDeviceStatusDAIntermediateValue,
} from "@ledgerhq/device-sdk-core";
import { GetDeviceStatusDAOutput } from "@ledgerhq/device-sdk-core/lib/cjs/index.js";

export const DeviceActionsView: React.FC = () => {
  const {
    state: { selectedId: selectedSessionId },
  } = useDeviceSessionsContext();
  const router = useRouter();
  const sdk = useSdk();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deviceActions: DeviceActionProps<any, any, any, any>[] = useMemo(
    () =>
      !selectedSessionId
        ? []
        : [
            {
              title: "Open app",
              description:
                "Perform all the actions necessary to open an app on the device",
              executeDeviceAction: ({ appName }, inspect) => {
                const deviceAction = new OpenAppDeviceAction({
                  input: { appName },
                  inspect,
                });
                return sdk.executeDeviceAction({
                  sessionId: selectedSessionId,
                  deviceAction,
                });
              },
              initialValues: { appName: "" },
            } satisfies DeviceActionProps<
              OpenAppDAOutput,
              OpenAppDAInput,
              OpenAppDAError,
              OpenAppDAIntermediateValue
            >,
            {
              title: "Get device status",
              description:
                "Perform various checks on the device to determine its status",
              executeDeviceAction: (_, inspect) => {
                const deviceAction = new GetDeviceStatusDeviceAction({
                  input: { unlockTimeout: 15000 },
                  inspect,
                });
                return sdk.executeDeviceAction({
                  sessionId: selectedSessionId,
                  deviceAction,
                });
              },
              initialValues: { unlockTimeout: 15000 },
            } satisfies DeviceActionProps<
              GetDeviceStatusDAOutput,
              GetDeviceStatusDAInput,
              GetDeviceStatusDAError,
              GetDeviceStatusDAIntermediateValue
            >,
          ],
    [],
  );

  if (!selectedSessionId) {
    router.replace("/");
    return null;
  }

  return (
    <PageWithHeader title="Device Actions">
      <Grid columns={1} rowGap={6} overflowY="scroll">
        {deviceActions.map((deviceAction) => (
          <DeviceAction
            key={`${deviceAction.title}_${deviceAction.description}`}
            {...deviceAction}
          />
        ))}
      </Grid>
    </PageWithHeader>
  );
};
