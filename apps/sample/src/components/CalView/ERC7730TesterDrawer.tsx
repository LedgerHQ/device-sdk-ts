import React, { useCallback, useEffect, useState } from "react";
import { Button, Divider, Flex, Input, Text } from "@ledgerhq/react-ui";

import { Block } from "@/components/Block";
import { useCalInterceptor } from "@/providers/CalInterceptorProvider";
import { useCalConfig } from "@/providers/SignerEthProvider";

type ERC7730TesterDrawerProps = {
  onClose: () => void;
};

export function ERC7730TesterDrawer({ onClose }: ERC7730TesterDrawerProps) {
  const {
    isActive,
    startInterception,
    stopInterception,
    storeDescriptor,
    clearStoredDescriptors,
    getStoredDescriptorCount,
  } = useCalInterceptor();
  const { calConfig, setCalConfig } = useCalConfig();

  const [erc7730Input, setERC7730Input] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [descriptorCount, setDescriptorCount] = useState<number>(0);

  useEffect(() => {
    setDescriptorCount(getStoredDescriptorCount());
  }, [getStoredDescriptorCount]);

  const addERC7730 = useCallback(async () => {
    if (!erc7730Input.trim()) {
      setError("Please enter ERC7730 descriptor");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/process-erc7730-descriptor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: erc7730Input.trim(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        setError(`HTTP ${response.status}: ${errorText}`);
        setIsLoading(false);
        return;
      }

      // Get the processed descriptors from the server
      const result = await response.json();
      const { descriptors } = result;

      // Store each descriptor in localStorage via provider
      Object.entries(descriptors).forEach(([key, descriptorData]) => {
        const [chainId, address] = key.split(":");
        storeDescriptor(parseInt(chainId), address, descriptorData);
      });

      // Update descriptor count
      setDescriptorCount(getStoredDescriptorCount());
      setError(null);
      setIsLoading(false);
      onClose();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      setError(`Failed to add ERC7730 descriptor: ${errorMessage}`);
      setIsLoading(false);
    }
  }, [erc7730Input, onClose]);

  useEffect(() => {
    if (isActive) {
      // Tester cannot work with prod signatures
      setCalConfig({
        ...calConfig,
        mode: "test",
      });
    }
  }, [isActive]);

  const toggleInterceptor = useCallback(() => {
    if (isActive) {
      stopInterception();
    } else {
      startInterception();
    }
  }, [isActive, startInterception, stopInterception]);

  const handleClearDescriptors = useCallback(() => {
    clearStoredDescriptors();
    setDescriptorCount(0);
  }, [clearStoredDescriptors]);

  return (
    <Block>
      <Flex flexDirection="column" rowGap={3} columnGap={3}>
        <Text variant="paragraph" fontWeight="medium">
          Request Interceptor
        </Text>
        <Flex flexDirection="row" flexWrap="wrap" rowGap={2} columnGap={2}>
          <Button
            variant={isActive ? "shade" : "main"}
            onClick={toggleInterceptor}
          >
            {isActive ? "Interceptor Active" : "Interceptor Inactive"}
          </Button>
          {descriptorCount > 0 && (
            <Button variant="main" onClick={handleClearDescriptors}>
              Clear {descriptorCount} Stored Descriptors
            </Button>
          )}
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
