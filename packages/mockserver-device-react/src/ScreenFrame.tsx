import React from "react";

type ScreenFrameProps = {
  children: React.ReactNode;
};

/**
 * The bezel around whatever stands in for the screen. The border lives here,
 * outside the content, so the live frame and the app list inside it take
 * exactly the screen's size.
 */
export const ScreenFrame: React.FC<ScreenFrameProps> = ({ children }) => (
  <div className="border-muted @container relative overflow-hidden rounded-md border">
    {children}
  </div>
);
