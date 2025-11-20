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

import React, { type PropsWithChildren } from "react";
import { Flex, StyleProvider } from "@ledgerhq/react-ui";
import dynamic from "next/dynamic";
import styled, { type DefaultTheme } from "styled-components";

import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { DmkProvider } from "@/providers/DeviceManagementKitProvider";
import { DeviceSessionsProvider } from "@/providers/DeviceSessionsProvider";
import { DmkConfigProvider } from "@/providers/DmkConfig";
import { LedgerKeyRingProtocolProvider } from "@/providers/LedgerKeyringProvider";
import { SignerEthProvider } from "@/providers/SignerEthProvider";
import { GlobalStyle } from "@/styles/globalstyles";

const FloatingIcon = dynamic(
  () =>
    import("@/components/FloatingIcon").then((mod) => ({
      default: mod.FloatingIcon,
    })),
  {
    ssr: false,
  },
);

const Root = styled(Flex)`
  flex-direction: row;
  color: ${({ theme }: { theme: DefaultTheme }) => theme.colors.neutral.c90};
  height: 100%;
  flex: 1;
`;

const PageContainer = styled(Flex)`
  flex-direction: column;
  background-color: ${({ theme }: { theme: DefaultTheme }) =>
    theme.colors.background.main};
  flex: 1;
`;

const ClientRootLayout: React.FC<PropsWithChildren> = ({ children }) => {
  return (
    <html lang="en">
      <DmkConfigProvider>
        <DmkProvider>
          <DeviceSessionsProvider>
            <LedgerKeyRingProtocolProvider>
              <SignerEthProvider>
                <StyleProvider selectedPalette="dark" fontsPath="/fonts">
                  <GlobalStyle />
                  <head>
                    <link rel="shortcut icon" href="../favicon.png" />
                  </head>
                  <body>
                    <Root>
                      <Sidebar />
                      <PageContainer>
                        <Header />
                        {children}
                      </PageContainer>
                      <FloatingIcon />
                    </Root>
                  </body>
                </StyleProvider>
              </SignerEthProvider>
            </LedgerKeyRingProtocolProvider>
          </DeviceSessionsProvider>
        </DmkProvider>
      </DmkConfigProvider>
    </html>
  );
};

export default ClientRootLayout;
