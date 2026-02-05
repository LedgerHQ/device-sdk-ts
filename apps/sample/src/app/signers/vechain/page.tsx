"use client";
import React from "react";

import { SessionIdWrapper } from "@/components/SessionIdWrapper";
import { SignerVechainView } from "@/components/SignerVechainView";

const Signer: React.FC = () => {
  return <SessionIdWrapper ChildComponent={SignerVechainView} />;
};

export default Signer;
