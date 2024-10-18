import React, { useCallback, useState } from "react";
import { Grid } from "@ledgerhq/react-ui";

import { ClickableListItem } from "@/components/ClickableListItem";
import { PageWithHeader } from "@/components/PageWithHeader";
import { StyledDrawer } from "@/components/StyledDrawer";

import { CalCheckDappDrawer } from "./CalCheckDappDrawer";

const CAL_SERVICE_ENTRIES = [
  {
    title: "Check dApp availability",
    description: "Check dApp availability in Crypto Asset List",
  },
];

export const CalView = () => {
  const [isCheckDappOpen, setIsCheckDappOpen] = useState(false);
  const openCheckDapp = useCallback(() => {
    setIsCheckDappOpen(true);
  }, []);

  const closeCheckDapp = useCallback(() => {
    setIsCheckDappOpen(false);
  }, []);

  const pageTitle = "Check dApp availability";
  const pageDescription = "Check descriptor availability on the CAL";

  return (
    <PageWithHeader title="Crypto Assets">
      <Grid
        columns={1}
        style={{ rowGap: 6, columnGap: 6, overflowY: "scroll" }}
      >
        {CAL_SERVICE_ENTRIES.map(({ title, description }) => (
          <ClickableListItem
            key={`keyring-${title}`}
            title={title}
            description={description}
            onClick={openCheckDapp}
          />
        ))}
      </Grid>
      <StyledDrawer
        isOpen={isCheckDappOpen}
        onClose={closeCheckDapp}
        big
        title={pageTitle}
        description={pageDescription}
      >
        <CalCheckDappDrawer
          title={""}
          description={""}
          initialValues={{
            smartContractAddress: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
            calUrl: "https://crypto-assets-service.api.ledger-test.com",
            branch: "main",
          }}
        />
      </StyledDrawer>
    </PageWithHeader>
  );
};
