import { DefaultTheme } from "styled-components/native";

export const getNavigationTheme: (
  theme: DefaultTheme,
) => ReactNavigation.Theme = theme => ({
  dark: theme.theme === "dark",
  colors: {
    primary: theme.colors.primary.c10,
    background: theme.colors.background.main,
    card: theme.colors.background.main,
    text: theme.colors.neutral.c100,
    border: theme.colors.constant.purple,
    notification: theme.colors.warning.c70,
  },
  fonts: {
    regular: {
      fontFamily: "System",
      fontWeight: "400",
    },
    medium: {
      fontFamily: "System",
      fontWeight: "500",
    },
    bold: {
      fontFamily: "System",
      fontWeight: "600",
    },
    heavy: {
      fontFamily: "System",
      fontWeight: "700",
    },
  },
});
