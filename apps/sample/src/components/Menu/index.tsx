import React from "react";
import { useSelector } from "react-redux";
import { Flex, Icons, Link } from "@ledgerhq/react-ui";
import { useRouter } from "next/navigation";
import styled from "styled-components";

import { selectTransportType } from "@/state/settings/selectors";

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
  const transportType = useSelector(selectTransportType);

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
          onClick={() => router.push("/device-actions")}
        >
          Device Actions
        </MenuTitle>
      </MenuItem>
      <MenuItem>
        <Icons.LedgerLogo />
        <MenuTitle
          data-testid="CTA_route-to-/ledger-wallet"
          onClick={() => router.push("/ledger-wallet")}
        >
          Ledger Wallet
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
          data-testid="CTA_route-to-/clear-signing-tools"
          onClick={() => router.push("/clear-signing-tools")}
        >
          Clear Signing Tools
        </MenuTitle>
      </MenuItem>
      <MenuItem>
        <Icons.SettingsAlt2 />
        <MenuTitle onClick={() => router.push("/settings")}>Settings</MenuTitle>
      </MenuItem>
      {transportType === "mockserver" && (
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
