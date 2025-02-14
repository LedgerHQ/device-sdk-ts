import React from "react";
import { Button } from "@ledgerhq/native-ui";
import { useDmk } from "_providers/dmkProvider";

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
