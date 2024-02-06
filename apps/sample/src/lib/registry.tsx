/**
 * src/lib/registry.tsx
 * Styled Component Registry
 *
 * use the styled-components API to create a global registry component
 * to collect all CSS style rules generated during a render,
 * and a function to return those rules.
 * Then use the useServerInsertedHTML hook to inject the styles collected
 * in the registry into the <head> HTML tag in the root layout.
 *
 * https://nextjs.org/docs/app/building-your-application/styling/css-in-js#styled-components
 *
 */
"use client";

import React, { useState } from "react";
import { useServerInsertedHTML } from "next/navigation";
import { ServerStyleSheet, StyleSheetManager } from "styled-components";

type StyledComponentsRegistryProps = {
  children: React.ReactNode;
};

export const StyledComponentsRegistry: React.FC<
  StyledComponentsRegistryProps
> = ({ children }) => {
  // Only create stylesheet once with lazy initial state
  // x-ref: https://reactjs.org/docs/hooks-reference.html#lazy-initial-state
  const [styledComponentsStyleSheet] = useState(() => new ServerStyleSheet());

  useServerInsertedHTML(() => {
    const styles = styledComponentsStyleSheet.getStyleElement();
    styledComponentsStyleSheet.instance.clearTag();
    return <>{styles}</>;
  });

  if (typeof window !== "undefined") return <>{children}</>;

  return (
    <StyleSheetManager sheet={styledComponentsStyleSheet.instance}>
      {children}
    </StyleSheetManager>
  );
};
