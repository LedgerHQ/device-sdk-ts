"use client";
import React from "react";

import { SessionIdWrapper } from "@/components/SessionIdWrapper";
import { SignerBtcView } from "@/components/SignerBtcView";

const Signer: React.FC = () => {
  return <SessionIdWrapper ChildComponent={SignerBtcView} />;
};

export default Signer;
