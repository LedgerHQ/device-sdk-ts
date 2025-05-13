import React from "react";
import { useDmk } from "_providers/dmkProvider";
import { Button } from "@ledgerhq/native-ui";

export const DisconnectButton: React.FC<{ sessionId: string }> = ({
  sessionId,
}) => {
  const dmk = useDmk();

  return (
    <Button type="main" onPress={() => dmk.disconnect({ sessionId })}>
      Disconnect
    </Button>
  );
};
