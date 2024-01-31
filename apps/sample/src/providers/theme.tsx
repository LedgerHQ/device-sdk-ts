import React, { useMemo } from "react";
import { defaultTheme, palettes } from "@ledgerhq/react-ui/styles/index";
import { DefaultTheme, ThemeProvider } from "styled-components";

interface CustomThemeProviderProps {
  children: React.ReactNode;
}

export const CustomThemeProvider: React.FC<CustomThemeProviderProps> = ({
  children,
}) => {
  const selectedPalettes: "dark" | "light" = "dark";

  const theme = useMemo<DefaultTheme>(
    () => ({
      ...defaultTheme,
      theme: selectedPalettes,
      colors: {
        ...defaultTheme.colors,
        ...palettes[selectedPalettes],
      },
    }),
    []
  );

  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
};
