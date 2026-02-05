"use client";
import React from "react";

import { SessionIdWrapper } from "@/components/SessionIdWrapper";
import { SignerTronView } from "@/components/SignerTronView";

const Signer: React.FC = () => {
  return <SessionIdWrapper ChildComponent={SignerTronView} />;
};

export default Signer;
