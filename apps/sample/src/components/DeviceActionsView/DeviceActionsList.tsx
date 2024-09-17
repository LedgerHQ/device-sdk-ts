import { useCallback, useMemo, useState } from "react";
import { PageWithHeader } from "@/components/PageWithHeader";
import { Grid, Text } from "@ledgerhq/react-ui";
import {
  DeviceActionRow,
  DeviceActionTester,
  DeviceActionProps,
} from "./DeviceActionTester";

export const UNLOCK_TIMEOUT = 60 * 1000; // 1 minute

type Props = {
  title: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deviceActions: DeviceActionProps<any, any, any, any>[];
};

/**
 * Component to display a list of device actions that can be executed.
 */
export const DeviceActionsList: React.FC<Props> = ({
  title,
  deviceActions,
}) => {
  const [selectedDeviceAction, setSelectedDeviceAction] =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useState<DeviceActionProps<any, any, any, any> | null>(null);

  const breadcrumbsSegments = useMemo(
    () => [
      { label: title, value: title },
      ...(selectedDeviceAction
        ? [
            {
              label: selectedDeviceAction.title,
              value: selectedDeviceAction.title,
            },
          ]
        : []),
    ],
    [selectedDeviceAction],
  );

  const onChangeBreadcrumb = useCallback((breadcrumbs: string[]) => {
    if (breadcrumbs.length === 1) {
      setSelectedDeviceAction(null);
    }
  }, []);

  return (
    <PageWithHeader
      segments={breadcrumbsSegments}
      onChange={onChangeBreadcrumb}
    >
      {selectedDeviceAction ? (
        <>
          <Text mb={3} variant="body">
            {selectedDeviceAction.description}
          </Text>
          <DeviceActionTester {...selectedDeviceAction} />
        </>
      ) : (
        <Grid columns={1} rowGap={6} overflowY="scroll">
          {deviceActions.map((deviceAction) => (
            <DeviceActionRow
              key={`${deviceAction.title}_${deviceAction.description}`}
              onClick={() => setSelectedDeviceAction(deviceAction)}
              {...deviceAction}
            />
          ))}
        </Grid>
      )}
    </PageWithHeader>
  );
};
