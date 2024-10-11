"use client";
import React from "react";

import { AllDeviceActions } from "@/components/DeviceActionsView/AllDeviceActions";
import { SessionIdWrapper } from "@/components/SessionIdWrapper";

const DeviceActions: React.FC = () => {
  return <SessionIdWrapper ChildComponent={AllDeviceActions} />;
};

export default DeviceActions;
