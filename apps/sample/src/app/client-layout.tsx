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
import { SignerEthProvider } from "@/providers/SignerEthProvider";
import { SignerAlgorandProvider } from "@/providers/SignerAlgorandProvider";
import { SignerAptosProvider } from "@/providers/SignerAptosProvider";
import { SignerCantonProvider } from "@/providers/SignerCantonProvider";
import { SignerCeloProvider } from "@/providers/SignerCeloProvider";
import { SignerConcordiumProvider } from "@/providers/SignerConcordiumProvider";
import { SignerHederaProvider } from "@/providers/SignerHederaProvider";
import { SignerHeliumProvider } from "@/providers/SignerHeliumProvider";
import { SignerIconProvider } from "@/providers/SignerIconProvider";
import { SignerKaspaProvider } from "@/providers/SignerKaspaProvider";
import { SignerMultiversxProvider } from "@/providers/SignerMultiversxProvider";
import { SignerNearProvider } from "@/providers/SignerNearProvider";
import { SignerPolkadotProvider } from "@/providers/SignerPolkadotProvider";
import { SignerStellarProvider } from "@/providers/SignerStellarProvider";
import { SignerSuiProvider } from "@/providers/SignerSuiProvider";
import { SignerTezosProvider } from "@/providers/SignerTezosProvider";
import { SignerTronProvider } from "@/providers/SignerTronProvider";
import { SignerVechainProvider } from "@/providers/SignerVechainProvider";
import { SignerXrpProvider } from "@/providers/SignerXrpProvider";
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
                  <SignerXrpProvider>
                  <SignerVechainProvider>
                  <SignerTronProvider>
                  <SignerTezosProvider>
                  <SignerSuiProvider>
                  <SignerStellarProvider>
                  <SignerPolkadotProvider>
                  <SignerNearProvider>
                  <SignerMultiversxProvider>
                  <SignerKaspaProvider>
                  <SignerIconProvider>
                  <SignerHeliumProvider>
                  <SignerHederaProvider>
                  <SignerConcordiumProvider>
                  <SignerCeloProvider>
                  <SignerCantonProvider>
                  <SignerAptosProvider>
                  <SignerAlgorandProvider>
                  <CalInterceptorProvider>
                    <GlobalStyle />
                    <head>
                      <link rel="shortcut icon" href="../favicon.png" />
                    </head>
                    <body>
                      <RootApp>{children}</RootApp>
                    </body>
                  </CalInterceptorProvider>
                </SignerAlgorandProvider>
                </SignerAptosProvider>
                </SignerCantonProvider>
                </SignerCeloProvider>
                </SignerConcordiumProvider>
                </SignerHederaProvider>
                </SignerHeliumProvider>
                </SignerIconProvider>
                </SignerKaspaProvider>
                </SignerMultiversxProvider>
                </SignerNearProvider>
                </SignerPolkadotProvider>
                </SignerStellarProvider>
                </SignerSuiProvider>
                </SignerTezosProvider>
                </SignerTronProvider>
                </SignerVechainProvider>
                </SignerXrpProvider>
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
