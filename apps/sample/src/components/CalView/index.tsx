import React, { useCallback, useState } from "react";
import { Grid } from "@ledgerhq/react-ui";

import { ClickableListItem } from "@/components/ClickableListItem";
import { PageWithHeader } from "@/components/PageWithHeader";
import { StyledDrawer } from "@/components/StyledDrawer";

import { AppProviderDrawer } from "./AppProviderDrawer";
import { CalCheckDappDrawer } from "./CalCheckDappDrawer";
import { CalSettingsDrawer } from "./CalSettingsDrawer";
import { Web3ChecksDrawer } from "./Web3ChecksDrawer";

export const CalView = () => {
  const [isCheckDappOpen, setIsCheckDappOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isWeb3ChecksOpen, setIsWeb3ChecksOpen] = useState(false);
  const [isAppProviderOpen, setIsAppProviderOpen] = useState(false);

  const closeDrawers = useCallback(() => {
    setIsCheckDappOpen(false);
    setIsSettingsOpen(false);
    setIsWeb3ChecksOpen(false);
    setIsAppProviderOpen(false);
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
      title: "Web3Checks Settings",
      description: "Settings for the Web3Checks provider",
      onClick: () => setIsWeb3ChecksOpen(true),
    },
    {
      title: "App Provider",
      description: "Settings for custom app provider",
      onClick: () => setIsAppProviderOpen(true),
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
        isOpen={isWeb3ChecksOpen}
        onClose={closeDrawers}
        big
        title="Web3Checks Settings"
        description="Settings for the Web3Checks provider"
      >
        <Web3ChecksDrawer onClose={closeDrawers} />
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
    </PageWithHeader>
  );
};
