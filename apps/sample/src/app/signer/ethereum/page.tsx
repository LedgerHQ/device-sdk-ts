"use client";
import React from "react";
import dynamic from "next/dynamic";

import { SessionIdWrapper } from "@/components/SessionIdWrapper";
const SignerEthView = dynamic(
  () => import("@/components/SignerEthView").then((mod) => mod.SignerEthView),
  { ssr: false },
);

const Signer: React.FC = () => {
  return <SessionIdWrapper ChildComponent={SignerEthView} />;
};

export default Signer;
