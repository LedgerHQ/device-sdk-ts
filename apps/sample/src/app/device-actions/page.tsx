"use client";
import React from "react";

import { DeviceActionsView } from "@/components/DeviceActionsView";
import { SessionIdWrapper } from "@/components/SessionIdWrapper";

const DeviceActions: React.FC = () => {
  return <SessionIdWrapper ChildComponent={DeviceActionsView} />;
};

export default DeviceActions;
