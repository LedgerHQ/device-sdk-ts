import { Grid } from "@ledgerhq/react-ui";
import styled from "styled-components";

export const CommandsViewContainer = styled(Grid).attrs({
  columns: 1,
})`
  row-gap: 6px;
  overflow-y: scroll;
`;
