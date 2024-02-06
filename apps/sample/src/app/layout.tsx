/**
 * src/app/RootLayout.tsx
 *
 * Main layout component for server-side rendering.
 *
 * Combines Styled Components Registry with the ClientRootLayout
 * for rendering the application.
 */
import { StyledComponentsRegistry } from "@/lib/registry";

import ClientRootLayout from "./client-layout";

export const metadata = {
  title: "Ledger Device SDK",
  description: "Ledger Device SDK Sample App",
};

type RootLayoutProps = {
  children: React.ReactNode;
};

const RootLayout: React.FC<RootLayoutProps> = ({ children }) => {
  return (
    <StyledComponentsRegistry>
      <ClientRootLayout>{children}</ClientRootLayout>
    </StyledComponentsRegistry>
  );
};

// eslint-disable-next-line no-restricted-syntax
export default RootLayout;
