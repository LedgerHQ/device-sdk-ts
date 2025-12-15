import React from "react";
import { mockserverIdentifier } from "@ledgerhq/device-transport-kit-mockserver";
import { Flex, Icons, Link } from "@ledgerhq/react-ui";
import { useRouter } from "next/navigation";
import styled from "styled-components";

import { useTransport } from "@/state/settings/hooks";

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
  const transport = useTransport();

  return (
    <>
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
        <Icons.Signature />
        <MenuTitle
          data-testid="CTA_route-to-/signers"
          onClick={() => router.push("/signers")}
        >
          Signers
        </MenuTitle>
      </MenuItem>
      <MenuItem>
        <Icons.Apps />
        <MenuTitle
          data-testid="CTA_route-to-/trusted-apps"
          onClick={() => router.push("/trusted-apps")}
        >
          Trusted Apps
        </MenuTitle>
      </MenuItem>
      <MenuItem>
        <Icons.ListEye />
        <MenuTitle
          data-testid="CTA_route-to-/clear-signing"
          onClick={() => router.push("/clear-signing")}
        >
          Clear Signing (new)
        </MenuTitle>
      </MenuItem>
      <MenuItem>
        <Icons.Trash />
        <MenuTitle onClick={() => router.push("/cal")}>
          CAL (to remove)
        </MenuTitle>
      </MenuItem>
      <MenuItem>
        <Icons.SettingsAlt2 />
        <MenuTitle onClick={() => router.push("/settings")}>Settings</MenuTitle>
      </MenuItem>
      {transport === mockserverIdentifier && (
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
