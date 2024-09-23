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
  title: "Ledger Device Management Kit",
  description: "Ledger Device Management Kit Sample App",
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

export default RootLayout;
