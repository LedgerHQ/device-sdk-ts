import { CustomThemeProvider } from "@/providers/theme";
import { GlobalStyle } from "@/styles/globalstyles";
import type { AppProps } from "next/app";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <CustomThemeProvider>
        <GlobalStyle />
        <Component {...pageProps} />
      </CustomThemeProvider>
    </>
  );
}
