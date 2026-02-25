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
import { Provider as StoreProvider } from "react-redux";
import { Flex, StyleProvider } from "@ledgerhq/react-ui";
import dynamic from "next/dynamic";
import styled, { type DefaultTheme } from "styled-components";

import { Notifications } from "@/components/Notifications";
import { Sidebar } from "@/components/Sidebar";
import { useUpdateConnectionsRefresherOptions } from "@/hooks/useUpdateConnectionsRefresherOptions";
import { useUpdateDeviceSessions } from "@/hooks/useUpdateDeviceSessions";
import { CalInterceptorProvider } from "@/providers/CalInterceptorProvider";
import { DmkProvider } from "@/providers/DeviceManagementKitProvider";
import { LedgerKeyringProtocolProvider } from "@/providers/LedgerKeyringProvider";
import { SettingsGate } from "@/providers/SettingsGate";
import { SignerCosmosProvider } from "@/providers/SignerCosmosProvider";
import { SignerEthProvider } from "@/providers/SignerEthProvider";
import { store } from "@/state/store";
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

const RootApp: React.FC<PropsWithChildren> = ({ children }) => {
  useUpdateDeviceSessions();
  useUpdateConnectionsRefresherOptions();
  return (
    <Root>
      <Sidebar />
      <PageContainer>{children}</PageContainer>
      <FloatingIcon />
      <Notifications />
    </Root>
  );
};

const ClientRootLayout: React.FC<PropsWithChildren> = ({ children }) => {
  return (
    <html lang="en">
      <StyleProvider selectedPalette="dark" fontsPath="/fonts">
        <StoreProvider store={store}>
          <SettingsGate>
            <DmkProvider>
              <LedgerKeyringProtocolProvider>
                <SignerEthProvider>
                  <SignerCosmosProvider>
                    <CalInterceptorProvider>
                      <GlobalStyle />
                      <head>
                        <link rel="shortcut icon" href="../favicon.png" />
                      </head>
                      <body>
                        <RootApp>{children}</RootApp>
                      </body>
                    </CalInterceptorProvider>
                  </SignerCosmosProvider>
                </SignerEthProvider>
              </LedgerKeyringProtocolProvider>
            </DmkProvider>
          </SettingsGate>
        </StoreProvider>
      </StyleProvider>
    </html>
  );
};

export default ClientRootLayout;
