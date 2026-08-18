import styled from "styled-components";

export const LogBox = styled.div`
  display: flex;
  flex-direction: column;
  row-gap: 4px;
  max-height: 220px;
  overflow-y: scroll;
  padding: 12px;
  border-radius: 8px;
  background-color: ${(p) => p.theme.colors.neutral.c30};
`;
