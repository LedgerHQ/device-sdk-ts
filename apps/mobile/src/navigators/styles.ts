import theme from "@ledgerhq/native-ui/styles/theme";

export const getNavigationTheme: (
  isDarkMode: boolean,
) => ReactNavigation.Theme = isDarkMode => ({
  dark: isDarkMode,
  colors: {
    primary: theme.colors.primary.c40,
    background: theme.colors.background.main,
    card: theme.colors.background.main,
    text: theme.colors.primary.c80,
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
