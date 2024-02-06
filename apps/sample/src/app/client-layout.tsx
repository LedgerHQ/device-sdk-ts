/**
 * src/app/client-layout.tsx
 *
 * Root layout component for client-side rendering.
 *
 * Utilizes StyleProvider from @ledgerhq/react-ui,
 * GlobalStyle from "@/styles/globalstyles" and local fonts
 * for styling the client-side application.
 */
"use client";

import { StyleProvider } from "@ledgerhq/react-ui";

import { GlobalStyle } from "@/styles/globalstyles";

type ClientRootLayoutProps = {
  children: React.ReactNode;
};

const ClientRootLayout: React.FC<ClientRootLayoutProps> = ({ children }) => {
  return (
    <html lang="en">
      <StyleProvider selectedPalette="dark" fontsPath="/fonts">
        <GlobalStyle />
        <body>{children}</body>
      </StyleProvider>
    </html>
  );
};

export default ClientRootLayout;