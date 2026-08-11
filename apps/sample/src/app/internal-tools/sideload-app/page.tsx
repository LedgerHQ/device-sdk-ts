"use client";
import React from "react";

import { SessionIdWrapper } from "@/components/SessionIdWrapper";
import { SideloadAppView } from "@/components/SideloadAppView";

const SideloadApp: React.FC = () => {
  return <SessionIdWrapper ChildComponent={SideloadAppView} />;
};

export default SideloadApp;
