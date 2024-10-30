import React from "react";
import { BuiltinTransports } from "@ledgerhq/device-management-kit";
import { Flex, Icons, Link } from "@ledgerhq/react-ui";
import { useRouter } from "next/navigation";
import styled from "styled-components";

import { useDmkConfigContext } from "@/providers/DmkConfig";

const MenuItem = styled(Flex).attrs({ p: 3, pl: 5 })`
  align-items: center;
`;

const MenuTitle = styled(Link).attrs({
  variant: "paragraph",
  fontWeight: "semiBold",
  ml: 5,
})``;

export const Menu: React.FC = () => {
  const router = useRouter();
  const {
    state: { transport },
  } = useDmkConfigContext();

  return (
    <>
      <MenuItem>
        <Icons.PlusCircle />
        <MenuTitle>App session</MenuTitle>
      </MenuItem>
      <MenuItem>
        <Icons.LedgerDevices />
        <MenuTitle
          data-testid="CTA_route-to-/commands"
          onClick={() => router.push("/commands")}
        >
          Commands
        </MenuTitle>
      </MenuItem>
      <MenuItem>
        <Icons.LedgerDevices />
        <MenuTitle
          data-testid="CTA_route-to-/device-actions"
          onClick={() => router.push("device-actions")}
        >
          Device actions
        </MenuTitle>
      </MenuItem>
      <MenuItem>
        <Icons.WirelessCharging />
        <MenuTitle
          data-testid="CTA_route-to-/apdu"
          onClick={() => router.push("/apdu")}
        >
          APDU
        </MenuTitle>
      </MenuItem>
      <MenuItem>
        <Icons.Apps />
        <MenuTitle>Install app</MenuTitle>
      </MenuItem>
      <MenuItem>
        <Icons.Signature />
        <MenuTitle
          data-testid="CTA_route-to-/keyring"
          onClick={() => router.push("/keyring")}
        >
          Keyrings
        </MenuTitle>
      </MenuItem>
      <MenuItem>
        <Icons.SettingsAlt2 />
        <MenuTitle onClick={() => router.push("/cal")}>Crypto Assets</MenuTitle>
      </MenuItem>
      {transport === BuiltinTransports.MOCK_SERVER && (
        <MenuItem>
          <Icons.Settings />
          <MenuTitle
            data-testid="CTA_route-to-/mock-settings"
            onClick={() => router.push("/mock")}
          >
            Mock Settings
          </MenuTitle>
        </MenuItem>
      )}
    </>
  );
};
