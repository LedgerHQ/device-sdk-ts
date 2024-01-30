/**
 * _document.tsx
 *
 * This is a special Next.js file used to create a custom document layout. It allows you
 * to enhance and optimize the server-side rendering of your application by customizing
 * the HTML document structure. This file is crucial for implementing global styles, meta
 * tags, and other layout-related configurations that should be applied on the server side.
 *
 * Keep in mind that changes made in this file affect the entire application's HTML structure,
 * so use it judiciously. For more information, refer to the Next.js documentation on customizing
 * the document: https://nextjs.org/docs/advanced-features/custom-document
 */

import type { DocumentContext, DocumentInitialProps } from "next/document";
import Document from "next/document";
import { ServerStyleSheet } from "styled-components";

export default class MyDocument extends Document {
  static async getInitialProps(
    ctx: DocumentContext
  ): Promise<DocumentInitialProps> {
    const sheet = new ServerStyleSheet();
    const originalRenderPage = ctx.renderPage;

    try {
      ctx.renderPage = () =>
        originalRenderPage({
          enhanceApp: (App) => (props) =>
            sheet.collectStyles(<App {...props} />),
        });

      const initialProps = await Document.getInitialProps(ctx);
      return {
        ...initialProps,
        styles: [initialProps.styles, sheet.getStyleElement()],
      };
    } finally {
      sheet.seal();
    }
  }
}
