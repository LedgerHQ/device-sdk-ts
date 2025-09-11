import React, { useCallback, useState } from "react";
import { Grid } from "@ledgerhq/react-ui";

import { ClickableListItem } from "@/components/ClickableListItem";
import { PageWithHeader } from "@/components/PageWithHeader";
import { StyledDrawer } from "@/components/StyledDrawer";

import { AppProviderDrawer } from "./AppProviderDrawer";
import { CalCheckDappDrawer } from "./CalCheckDappDrawer";
import { CalSettingsDrawer } from "./CalSettingsDrawer";
import { MetadataServiceDrawer } from "./MetadataServiceDrawer";
import { TransactionCheckDrawer } from "./TransactionCheckDrawer";

export const CalView = () => {
  const [isCheckDappOpen, setIsCheckDappOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTransactionCheckOpen, setIsTransactionCheckOpen] = useState(false);
  const [isAppProviderOpen, setIsAppProviderOpen] = useState(false);
  const [isMetadataServiceOpen, setIsMetadataServiceOpen] = useState(false);

  const closeDrawers = useCallback(() => {
    setIsCheckDappOpen(false);
    setIsSettingsOpen(false);
    setIsTransactionCheckOpen(false);
    setIsAppProviderOpen(false);
    setIsMetadataServiceOpen(false);
  }, []);

  const entries = [
    {
      title: "Settings",
      description: "Settings for the Crypto Asset List",
      onClick: () => setIsSettingsOpen(true),
    },
    {
      title: "Check dApp availability",
      description: "Check dApp availability in Crypto Asset List",
      onClick: () => setIsCheckDappOpen(true),
    },
    {
      title: "Transaction Check Settings",
      description: "Settings for the Transaction Check provider",
      onClick: () => setIsTransactionCheckOpen(true),
    },
    {
      title: "App Provider",
      description: "Settings for custom app provider",
      onClick: () => setIsAppProviderOpen(true),
    },
    {
      title: "Metadata Service Settings",
      description: "Settings for the Metadata Service provider",
      onClick: () => setIsMetadataServiceOpen(true),
    },
  ];

  const pageTitle = "Check dApp availability";
  const pageDescription = "Check descriptor availability on the CAL";

  return (
    <PageWithHeader title="Crypto Assets">
      <Grid
        columns={1}
        style={{ rowGap: 6, columnGap: 6, overflowY: "scroll" }}
      >
        {entries.map(({ title, description, onClick }) => (
          <ClickableListItem
            key={`signer-${title}`}
            title={title}
            description={description}
            onClick={onClick}
          />
        ))}
      </Grid>
      <StyledDrawer
        isOpen={isCheckDappOpen}
        onClose={closeDrawers}
        big
        title={pageTitle}
        description={pageDescription}
      >
        <CalCheckDappDrawer
          title={""}
          description={""}
          initialValues={{
            smartContractAddress: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
          }}
        />
      </StyledDrawer>
      <StyledDrawer
        isOpen={isSettingsOpen}
        onClose={closeDrawers}
        big
        title="CAL Settings"
        description="Settings for the Crypto Asset List"
      >
        <CalSettingsDrawer onClose={closeDrawers} />
      </StyledDrawer>
      <StyledDrawer
        isOpen={isTransactionCheckOpen}
        onClose={closeDrawers}
        big
        title="Transaction Check Settings"
        description="Settings for the Transaction Check provider"
      >
        <TransactionCheckDrawer onClose={closeDrawers} />
      </StyledDrawer>
      <StyledDrawer
        isOpen={isAppProviderOpen}
        onClose={closeDrawers}
        big
        title="App Provider"
        description="Settings for custom app provider"
      >
        <AppProviderDrawer onClose={closeDrawers} />
      </StyledDrawer>
      <StyledDrawer
        isOpen={isMetadataServiceOpen}
        onClose={closeDrawers}
        big
        title="Metadata Service Settings"
        description="Settings for the Metadata Service provider"
      >
        <MetadataServiceDrawer onClose={closeDrawers} />
      </StyledDrawer>
    </PageWithHeader>
  );
};
