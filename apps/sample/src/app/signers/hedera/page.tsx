"use client";
import React from "react";

import { SessionIdWrapper } from "@/components/SessionIdWrapper";
import { SignerHederaView } from "@/components/SignerHederaView";

const Signer: React.FC = () => {
  return <SessionIdWrapper ChildComponent={SignerHederaView} />;
};

export default Signer;
