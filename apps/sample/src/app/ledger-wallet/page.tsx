"use client";
import React from "react";
import { LedgerWalletDeviceActions } from "@/components/LedgerWalletView/LedgerWalletDeviceActions";
import { SessionIdWrapper } from "@/components/SessionIdWrapper";

const LedgerWallet: React.FC = () => {
  return <SessionIdWrapper ChildComponent={LedgerWalletDeviceActions} />;
};

export default LedgerWallet;
