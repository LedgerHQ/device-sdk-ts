import { createGlobalStyle } from "styled-components";

export const GlobalStyle = createGlobalStyle`
  html,
  body,
  #__next,
  main {
    width: 100%;
    height: 100%;
    padding: 0;
    margin: 0;
    background-color: #000000;
  }
  body {
    user-select: none;
  }
  .no-scrollbar {
      &::-webkit-scrollbar {
          width: 0px;
          height: 0px;
      }
  }
`;
