"use client";
import React from "react";

import { SessionIdWrapper } from "@/components/SessionIdWrapper";
import { SignerIconView } from "@/components/SignerIconView";

const Signer: React.FC = () => {
  return <SessionIdWrapper ChildComponent={SignerIconView} />;
};

export default Signer;
