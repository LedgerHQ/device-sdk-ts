import React from "react";

export const SettingBox: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <div className="flex flex-1 flex-row justify-between gap-32">
      {children}
    </div>
  );
};
