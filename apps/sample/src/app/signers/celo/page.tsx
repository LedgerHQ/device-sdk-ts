"use client";
import React from "react";

import { SessionIdWrapper } from "@/components/SessionIdWrapper";
import { SignerCelo } from "@/components/SignerCelo";

const Signer: React.FC = () => {
  return <SessionIdWrapper ChildComponent={SignerCelo} />;
};

export default Signer;
