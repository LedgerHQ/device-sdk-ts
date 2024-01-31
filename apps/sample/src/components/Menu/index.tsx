import { Flex, Icons, Text } from "@ledgerhq/react-ui";
import styled from "styled-components";

const MenuItem = styled(Flex).attrs({ p: 3, pl: 5 })`
  align-items: center;
`;

const MenuTitle = styled(Text).attrs({
  variant: "paragraph",
  fontWeight: "semiBold",
  ml: 5,
})``;

export const Menu: React.FC = () => {
  return (
    <>
      <MenuItem>
        <Icons.PlusCircle />
        <MenuTitle>App session</MenuTitle>
      </MenuItem>
      <MenuItem>
        <Icons.LedgerDevices />
        <MenuTitle>Device action</MenuTitle>
      </MenuItem>
      <MenuItem>
        <Icons.WirelessCharging />
        <MenuTitle>APDU</MenuTitle>
      </MenuItem>
      <MenuItem>
        <Icons.Apps />
        <MenuTitle>Install app</MenuTitle>
      </MenuItem>
    </>
  );
};
