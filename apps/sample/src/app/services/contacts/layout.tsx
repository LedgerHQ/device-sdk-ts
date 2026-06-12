"use client";
import React, { type PropsWithChildren } from "react";

import { ContactsLogsPanel } from "@/components/ContactsView/ContactsLogsPanel";

const ContactsLayout: React.FC<PropsWithChildren> = ({ children }) => {
  return (
    <>
      {children}
      <ContactsLogsPanel />
    </>
  );
};

// Next.js App Router layouts must default-export — the framework looks up
// the default export by convention. Mirrors apps/sample/src/app/layout.tsx.
// eslint-disable-next-line no-restricted-syntax
export default ContactsLayout;
