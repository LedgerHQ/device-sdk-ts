/**
 * src/app/client-layout.tsx
 *
 * Root layout component for client-side rendering.
 *
 * Wires the providers and the Lumen theme around the client-side application.
 */
"use client";

import React, { type PropsWithChildren } from "react";
import { Provider as StoreProvider } from "react-redux";
import { ThemeProvider } from "@ledgerhq/lumen-ui-react";

import { Notifications } from "@/components/Notifications";
import { Sidebar } from "@/components/Sidebar";
import { useUpdateConnectionsRefresherOptions } from "@/hooks/useUpdateConnectionsRefresherOptions";
import { useUpdateDeviceSessions } from "@/hooks/useUpdateDeviceSessions";
import { CalInterceptorProvider } from "@/providers/CalInterceptorProvider";
import { ContactsProvider } from "@/providers/ContactsProvider";
import { DmkProvider } from "@/providers/DeviceManagementKitProvider";
import { LedgerKeyringProtocolProvider } from "@/providers/LedgerKeyringProvider";
import { SettingsGate } from "@/providers/SettingsGate";
import { SignerAleoProvider } from "@/providers/SignerAleoProvider";
import { SignerCosmosProvider } from "@/providers/SignerCosmosProvider";
import { SignerEthProvider } from "@/providers/SignerEthProvider";
import { SignerPolkadotProvider } from "@/providers/SignerPolkadotProvider";
import { SignerXrpProvider } from "@/providers/SignerXrpProvider";
import { SignerZcashProvider } from "@/providers/SignerZcashProvider";
import { store } from "@/state/store";

const RootApp: React.FC<PropsWithChildren> = ({ children }) => {
  useUpdateDeviceSessions();
  useUpdateConnectionsRefresherOptions();
  return (
    <ThemeProvider colorScheme="dark">
      <div className="flex h-full flex-1 flex-row text-base">
        <Sidebar />
        <div className="flex flex-1 flex-col bg-canvas">{children}</div>
        <Notifications />
      </div>
    </ThemeProvider>
  );
};

const ClientRootLayout: React.FC<PropsWithChildren> = ({ children }) => {
  return (
    <html lang="en">
      <StoreProvider store={store}>
        <SettingsGate>
          <DmkProvider>
            <LedgerKeyringProtocolProvider>
              <SignerEthProvider>
                <SignerXrpProvider>
                  <SignerPolkadotProvider>
                    <SignerZcashProvider>
                      <SignerAleoProvider>
                        <SignerCosmosProvider>
                          <ContactsProvider>
                            <CalInterceptorProvider>
                              <head>
                                <link
                                  rel="shortcut icon"
                                  href="../favicon.png"
                                />
                              </head>
                              <body>
                                <RootApp>{children}</RootApp>
                              </body>
                            </CalInterceptorProvider>
                          </ContactsProvider>
                        </SignerCosmosProvider>
                      </SignerAleoProvider>
                    </SignerZcashProvider>
                  </SignerPolkadotProvider>
                </SignerXrpProvider>
              </SignerEthProvider>
            </LedgerKeyringProtocolProvider>
          </DmkProvider>
        </SettingsGate>
      </StoreProvider>
    </html>
  );
};

export default ClientRootLayout;
