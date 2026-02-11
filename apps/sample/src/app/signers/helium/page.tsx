"use client";
import React from "react";

import { SessionIdWrapper } from "@/components/SessionIdWrapper";
import { SignerHeliumView } from "@/components/SignerHeliumView";

const Signer: React.FC = () => {
  return <SessionIdWrapper ChildComponent={SignerHeliumView} />;
};

export default Signer;
