/**
 * _app.tsx
 *
 * This is a special Next.js file used to wrap the entire application and provide a common
 * layout or functionality across all pages. It allows you to maintain state, apply global
 * styles, and handle other aspects that should persist across different pages.
 *
 * The `App` component in this file is initialized once for the entire application and is
 * used to customize the rendering of pages. For more information, refer to the Next.js
 * documentation on customizing the App component:
 * https://nextjs.org/docs/advanced-features/custom-app
 */

import { GlobalStyle } from "@/styles/globalstyles";
import { StyleProvider } from "@ledgerhq/react-ui";
import type { AppProps } from "next/app";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export default function App({ Component, pageProps }: AppProps) {
  return (
    <main className={inter.className}>
      <StyleProvider selectedPalette="dark">
        <GlobalStyle />
        <Component {...pageProps} />
      </StyleProvider>
    </main>
  );
}
