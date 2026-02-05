"use client";
import React from "react";

import { SessionIdWrapper } from "@/components/SessionIdWrapper";
import { SignerAptosView } from "@/components/SignerAptosView";

const Signer: React.FC = () => {
  return <SessionIdWrapper ChildComponent={SignerAptosView} />;
};

export default Signer;
