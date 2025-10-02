import React, { useCallback, useState } from "react";
import { Button, Divider, Flex, Input, Text } from "@ledgerhq/react-ui";

import { Block } from "@/components/Block";
import { useCalConfig } from "@/providers/SignerEthProvider";

type ERC7730TesterDrawerProps = {
  onClose: () => void;
};

export function ERC7730TesterDrawer({ onClose }: ERC7730TesterDrawerProps) {
  const { calConfig, setCalConfig } = useCalConfig();
  const [erc7730Input, setERC7730Input] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const isProxyEnabled =
    calConfig.url === "/api/crypto-assets-service" && calConfig.mode === "test";

  const enableCalProxy = useCallback(() => {
    setCalConfig({
      url: "/api/crypto-assets-service",
      mode: "test",
      branch: "next",
    });
    setError(null);
  }, [calConfig]);

  const addERC7730 = useCallback(async () => {
    if (!erc7730Input.trim()) {
      setError("Please enter ERC7730 descriptor text");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/add-erc7730-descriptor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: erc7730Input.trim(),
      });

      if (!response.ok) {
        setError(`HTTP ${response.status}: ${response.statusText}`);
        setIsLoading(false);
      } else {
        onClose();
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      setError(`Failed to add ERC7730 descriptor: ${errorMessage}`);
    }
  }, [erc7730Input]);

  return (
    <Block>
      <Flex flexDirection="column" rowGap={3} columnGap={3}>
        <Text variant="paragraph" fontWeight="medium">
          CAL Configuration
        </Text>
        <Flex flexDirection="row" flexWrap="wrap" rowGap={2} columnGap={2}>
          <Button
            variant={isProxyEnabled ? "shade" : "main"}
            onClick={enableCalProxy}
            disabled={isProxyEnabled}
          >
            {isProxyEnabled ? "CAL Proxy Enabled" : "Enable CAL Proxy"}
          </Button>
        </Flex>

        <Divider />

        <Text variant="paragraph" fontWeight="medium">
          ERC7730 Descriptor
        </Text>
        <Flex flexDirection="row" flexWrap="wrap" rowGap={2} columnGap={2}>
          <Input
            placeholder="Paste your ERC7730 descriptor JSON here..."
            value={erc7730Input}
            onChange={setERC7730Input}
          />
        </Flex>
        <Flex flexDirection="row" flexWrap="wrap" rowGap={2} columnGap={2}>
          <Button
            variant="main"
            onClick={addERC7730}
            disabled={isLoading || !erc7730Input.trim()}
          >
            {isLoading ? "Adding ERC7730..." : "Add ERC7730"}
          </Button>
        </Flex>

        {error && (
          <Flex flexDirection="row" flexWrap="wrap" rowGap={2} columnGap={2}>
            <Text variant="body" color="error.c60">
              {error}
            </Text>
          </Flex>
        )}
      </Flex>
    </Block>
  );
}
