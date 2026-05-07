import React from "react";
import { Flex, Grid, Icons } from "@ledgerhq/react-ui";
import { useRouter } from "next/navigation";

import { ClickableListItem } from "@/components/ClickableListItem";
import { PageWithHeader } from "@/components/PageWithHeader";

const SUPPORTED_SERVICES = [
  {
    title: "Contacts",
    description:
      "Manage cross-chain Contacts and signer-controlled Ledger accounts. Decorates the Send review on device.",
    href: "/services/contacts",
    icon: (
      <Flex p={3} backgroundColor="background.card" borderRadius="50%">
        <Icons.User size="L" />
      </Flex>
    ),
  },
];

export const ServicesView: React.FC = () => {
  const router = useRouter();

  return (
    <PageWithHeader title="Services">
      <Grid
        columns={2}
        style={{ rowGap: 6, columnGap: 6, overflowY: "scroll" }}
      >
        {SUPPORTED_SERVICES.map(({ title, description, icon, href }) => (
          <ClickableListItem
            key={`services-${title}`}
            title={title}
            description={description}
            onClick={() => router.push(href)}
            icon={icon}
          />
        ))}
      </Grid>
    </PageWithHeader>
  );
};
