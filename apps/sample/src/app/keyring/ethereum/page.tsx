"use client";
import React from "react";

import { KeyringEthView } from "@/components/KeyringEthView";
import { SessionIdWrapper } from "@/components/SessionIdWrapper";

const Keyring: React.FC = () => {
  return <SessionIdWrapper ChildComponent={KeyringEthView} />;
};

export default Keyring;
