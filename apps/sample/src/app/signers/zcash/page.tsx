"use client";
import React from "react";

import { SessionIdWrapper } from "@/components/SessionIdWrapper";
import { SignerZcashView } from "@/components/SignerZcashView";

const Signer: React.FC = () => {
  return <SessionIdWrapper ChildComponent={SignerZcashView} />;
};

export default Signer;
