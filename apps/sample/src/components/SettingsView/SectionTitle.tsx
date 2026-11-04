import React from "react";

type SectionTitleProps = {
  children: React.ReactNode;
};

export const SectionTitle: React.FC<SectionTitleProps> = ({ children }) => {
  return <h3 className="heading-5-semi-bold text-base">{children}</h3>;
};
