"use client";
import React from "react";

import { ContactsView } from "@/components/ContactsView";
import { SessionIdWrapper } from "@/components/SessionIdWrapper";

const Contacts: React.FC = () => {
  return <SessionIdWrapper ChildComponent={ContactsView} />;
};

export default Contacts;
