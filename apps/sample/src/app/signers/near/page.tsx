"use client";
import React from "react";

import { SessionIdWrapper } from "@/components/SessionIdWrapper";
import { SignerNearView } from "@/components/SignerNearView";

const Signer: React.FC = () => {
  return <SessionIdWrapper ChildComponent={SignerNearView} />;
};

export default Signer;
