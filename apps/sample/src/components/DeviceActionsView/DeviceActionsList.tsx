import React from "react";
import { useCallback, useMemo, useState } from "react";

import { PageWithHeader } from "@/components/PageWithHeader";

import {
  type DeviceActionProps,
  DeviceActionRow,
  DeviceActionTester,
} from "./DeviceActionTester";

export const UNLOCK_TIMEOUT = 60 * 1000; // 1 minute

type Props = {
  title: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deviceActions: DeviceActionProps<any, any, any, any>[];
  noActionsMessage?: string;
};

/**
 * Component to display a list of device actions that can be executed.
 */
export const DeviceActionsList: React.FC<Props> = ({
  title,
  deviceActions,
  noActionsMessage,
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
    [selectedDeviceAction, title],
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
          <span className="body-2 mb-8">
            {selectedDeviceAction.description}
          </span>
          <DeviceActionTester {...selectedDeviceAction} />
        </>
      ) : deviceActions.length === 0 && noActionsMessage ? (
        <span className="body-2">{noActionsMessage}</span>
      ) : (
        <div className="flex flex-col overflow-scroll pb-12 gap-y-12">
          {deviceActions.map((deviceAction) => (
            <DeviceActionRow
              key={`${deviceAction.title}_${deviceAction.description}`}
              onClick={() => setSelectedDeviceAction(deviceAction)}
              {...deviceAction}
            />
          ))}
        </div>
      )}
    </PageWithHeader>
  );
};
