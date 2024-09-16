"use client";
import React from "react";

import { SessionIdWrapper } from "@/components/SessionIdWrapper";
import { AllDeviceActions } from "@/components/DeviceActionsView/AllDeviceActions";

const DeviceActions: React.FC = () => {
  return <SessionIdWrapper ChildComponent={AllDeviceActions} />;
};

export default DeviceActions;
