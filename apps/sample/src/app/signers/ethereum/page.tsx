"use client";
import React from "react";

import { SessionIdWrapper } from "@/components/SessionIdWrapper";
import { SignerEthView } from "@/components/SignerEthView";

const Signer: React.FC = () => {
  return <SessionIdWrapper ChildComponent={SignerEthView} />;
};

export default Signer;
