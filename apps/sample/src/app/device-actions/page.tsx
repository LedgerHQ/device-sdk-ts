"use client";
import React from "react";
import dynamic from "next/dynamic";

import { SessionIdWrapper } from "@/components/SessionIdWrapper";
const AllDeviceActions = dynamic(
  () =>
    import("@/components/DeviceActionsView/AllDeviceActions").then(
      (mod) => mod.AllDeviceActions,
    ),
  { ssr: false },
);

const DeviceActions: React.FC = () => {
  return <SessionIdWrapper ChildComponent={AllDeviceActions} />;
};

export default DeviceActions;
