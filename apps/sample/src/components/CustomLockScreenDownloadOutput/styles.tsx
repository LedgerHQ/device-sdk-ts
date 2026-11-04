import React from "react";

export const Container: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div className="flex flex-col items-center gap-16 rounded-md bg-muted p-16">
    {children}
  </div>
);

export const PreviewImage: React.FC<React.ComponentProps<"img">> = (props) => (
  <img
    className="max-h-[400px] max-w-[300px] rounded-sm border border-muted-strong object-contain"
    {...props}
  />
);

export const MetadataContainer: React.FC<React.PropsWithChildren> = ({
  children,
}) => <div className="flex flex-col items-center gap-4">{children}</div>;

export const MetadataText: React.FC<React.PropsWithChildren> = ({
  children,
}) => <span className="body-3 text-muted">{children}</span>;

export const HashText: React.FC<React.PropsWithChildren> = ({ children }) => (
  <span className="body-4 max-w-[300px] text-center font-mono break-all text-muted">
    {children}
  </span>
);
