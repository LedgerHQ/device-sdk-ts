"use client";
import React from "react";

import { SessionIdWrapper } from "@/components/SessionIdWrapper";
import { SignerSuiView } from "@/components/SignerSuiView";

const Signer: React.FC = () => {
  return <SessionIdWrapper ChildComponent={SignerSuiView} />;
};

export default Signer;
