"use client";
import React from "react";

import { SessionIdWrapper } from "@/components/SessionIdWrapper";
import { SignerXrpView } from "@/components/SignerXrpView";

const Signer: React.FC = () => {
  return <SessionIdWrapper ChildComponent={SignerXrpView} />;
};

export default Signer;
