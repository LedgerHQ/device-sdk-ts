import React from "react";
import { useSelector } from "react-redux";
import { DeleteCircleFill } from "@ledgerhq/lumen-ui-react/symbols";

import { selectSelectedSessionId } from "@/state/sessions/selectors";

import { ConnectDeviceButtons } from "./ConnectDevice/ConnectDeviceButtons";

/**
 * Component that wraps the child component and passes it the selected sessionId.
 * If there is no selected sessionId, it renders a message and a button to
 * connect a device.
 */
export const SessionIdWrapper: React.FC<{
  ChildComponent: React.ComponentType<{ sessionId: string }>;
}> = ({ ChildComponent }) => {
  const sessionId = useSelector(selectSelectedSessionId);

  if (!sessionId) {
    return (
      <div
        className="flex p-16 flex-1 items-center justify-center flex-col gap-y-16 self-center"
        style={{ width: 400 }}
      >
        <DeleteCircleFill size={32} className="text-error" />
        <span className="body-2 text-center">
          No selected session id, first connect a device.
        </span>
        <ConnectDeviceButtons />
      </div>
    );
  }

  return <ChildComponent key={sessionId} sessionId={sessionId} />;
};
