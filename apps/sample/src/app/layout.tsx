/**
 * src/app/RootLayout.tsx
 *
 * Main layout component for server-side rendering.
 *
 * Combines Styled Components Registry with the ClientRootLayout
 * for rendering the application.
 */
import React, { type PropsWithChildren } from "react";

import { StyledComponentsRegistry } from "@/lib/registry";

import ClientRootLayout from "./client-layout";

export const metadata = {
  title: "Ledger Device Management Kit",
  description: "Ledger Device Management Kit Sample App",
};

const RootLayout: React.FC<PropsWithChildren> = ({ children }) => {
  return (
    <html lang="en">
      <head>
        <link rel="shortcut icon" href="../favicon.png" />
      </head>
      <body>
        <StyledComponentsRegistry>
          <ClientRootLayout>{children}</ClientRootLayout>
        </StyledComponentsRegistry>
      </body>
    </html>
  );
};

// eslint-disable-next-line no-restricted-syntax
export default RootLayout;
