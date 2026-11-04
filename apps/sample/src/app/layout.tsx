/**
 * src/app/RootLayout.tsx
 *
 * Main layout component for server-side rendering.
 *
 * Renders the application inside the ClientRootLayout.
 */
import React, { type PropsWithChildren } from "react";

import ClientRootLayout from "./client-layout";

import "./lumen.css";

export const metadata = {
  title: "Ledger Device Management Kit",
  description: "Ledger Device Management Kit Sample App",
};

const RootLayout: React.FC<PropsWithChildren> = ({ children }) => {
  return <ClientRootLayout>{children}</ClientRootLayout>;
};

// eslint-disable-next-line no-restricted-syntax
export default RootLayout;
