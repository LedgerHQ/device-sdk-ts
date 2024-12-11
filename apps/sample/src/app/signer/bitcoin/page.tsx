"use client";
import React from "react";

import { SessionIdWrapper } from "@/components/SessionIdWrapper";
import { SignerBitcoinView } from "@/components/SignerBtcView";

const Signer: React.FC = () => {
  return <SessionIdWrapper ChildComponent={SignerBitcoinView} />;
};

export default Signer;
