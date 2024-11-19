"use client";
import React from "react";

import { SessionIdWrapper } from "@/components/SessionIdWrapper";
import { SignerNearView } from "@/components/SignerNearView";

const Keyring: React.FC = () => {
  return <SessionIdWrapper ChildComponent={SignerNearView} />;
};

export default Keyring;
