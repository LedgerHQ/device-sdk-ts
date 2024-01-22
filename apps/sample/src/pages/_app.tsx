import { CustomThemeProvider } from "@/providers/theme";
import { GlobalStyle } from "@/styles/globalstyles";
import type { AppProps } from "next/app";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export default function App({ Component, pageProps }: AppProps) {
  return (
    <main className={inter.className}>
      <CustomThemeProvider>
        <GlobalStyle />
        <Component {...pageProps} />
      </CustomThemeProvider>
    </main>
  );
}
