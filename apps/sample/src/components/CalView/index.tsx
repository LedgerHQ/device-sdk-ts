import React, { useCallback, useState } from "react";
import { Grid } from "@ledgerhq/react-ui";

import { ClickableListItem } from "@/components/ClickableListItem";
import { PageWithHeader } from "@/components/PageWithHeader";
import { StyledDrawer } from "@/components/StyledDrawer";

import { CalCheckDappDrawer } from "./CalCheckDappDrawer";
import { ERC7730TesterDrawer } from "./ERC7730TesterDrawer";

export const CalView = () => {
  const [isCheckDappOpen, setIsCheckDappOpen] = useState(false);
  const [isERC7730TesterOpen, setIsERC7730TesterOpen] = useState(false);

  const closeDrawers = useCallback(() => {
    setIsCheckDappOpen(false);
    setIsERC7730TesterOpen(false);
  }, []);

  const entries = [
    {
      title: "Check dApp availability",
      description: "Check dApp availability in Crypto Asset List",
      onClick: () => setIsCheckDappOpen(true),
    },
    {
      title: "ERC7730 Tester",
      description: "Test ERC7730 descriptors with Speculos device emulator",
      onClick: () => setIsERC7730TesterOpen(true),
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
        isOpen={isERC7730TesterOpen}
        onClose={closeDrawers}
        big
        title="ERC7730 Tester"
        description="Test ERC7730 descriptors with Speculos device emulator"
      >
        <ERC7730TesterDrawer />
      </StyledDrawer>
    </PageWithHeader>
  );
};
