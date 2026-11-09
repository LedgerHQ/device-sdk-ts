import React from "react";
import { Spot } from "@ledgerhq/lumen-ui-react";
import { Unlink } from "@ledgerhq/lumen-ui-react/symbols";

type Props = {
  title: string;
  description: React.ReactNode;
  codeExample: string;
};

export const NotConnectedMessage: React.FC<Props> = ({
  title,
  description,
  codeExample,
}) => (
  <div className="flex flex-1 flex-col items-center justify-center gap-16 overflow-auto p-24">
    <Spot appearance="muted" icon={Unlink} size={56} />
    <h3 className="heading-4-semi-bold">{title}</h3>
    <p className="max-w-480 text-center body-2 text-muted">{description}</p>
    <pre className="max-w-full overflow-auto rounded-md bg-muted p-16 font-mono! body-3">
      {codeExample}
    </pre>
  </div>
);
