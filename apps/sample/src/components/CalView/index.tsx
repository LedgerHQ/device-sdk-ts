import React, { useCallback, useState } from "react";
import { Grid } from "@ledgerhq/react-ui";

import { ClickableListItem } from "@/components/ClickableListItem";
import { PageWithHeader } from "@/components/PageWithHeader";
import { StyledDrawer } from "@/components/StyledDrawer";

import { CalCheckDappDrawer } from "./CalCheckDappDrawer";
import { CalSettingsDrawer } from "./CalSettingsDrawer";

export const CalView = () => {
  const [isCheckDappOpen, setIsCheckDappOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const openCheckDapp = useCallback(() => {
    setIsCheckDappOpen(true);
  }, []);

  const openSettings = useCallback(() => {
    setIsSettingsOpen(true);
  }, []);

  const closeDrawers = useCallback(() => {
    setIsCheckDappOpen(false);
    setIsSettingsOpen(false);
  }, []);

  const entries = [
    {
      title: "Settings",
      description: "Settings for the Crypto Asset List",
      onClick: openSettings,
    },
    {
      title: "Check dApp availability",
      description: "Check dApp availability in Crypto Asset List",
      onClick: openCheckDapp,
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
            key={`keyring-${title}`}
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
    </PageWithHeader>
  );
};
