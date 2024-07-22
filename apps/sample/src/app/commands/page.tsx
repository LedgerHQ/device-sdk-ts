"use client";
import React from "react";

import { CommandsView } from "@/components/CommandsView";
import { SessionIdWrapper } from "@/components/SessionIdWrapper";

const Commands: React.FC = () => {
  return <SessionIdWrapper ChildComponent={CommandsView} />;
};

export default Commands;
