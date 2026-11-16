"use client";
import React from "react";

import { SessionIdWrapper } from "@/components/SessionIdWrapper";
import { SignerIcpView } from "@/components/SignerIcpView";

const Signer: React.FC = () => {
  return <SessionIdWrapper ChildComponent={SignerIcpView} />;
};

export default Signer;
