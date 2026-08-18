"use client";
import React from "react";

import { OnboardDeviceView } from "@/components/OnboardDeviceView";
import { SessionIdWrapper } from "@/components/SessionIdWrapper";

const OnboardDevice: React.FC = () => {
  return <SessionIdWrapper ChildComponent={OnboardDeviceView} />;
};

export default OnboardDevice;
