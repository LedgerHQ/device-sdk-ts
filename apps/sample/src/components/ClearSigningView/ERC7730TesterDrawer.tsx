import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  addERC7730Descriptor,
  ERC7730Client,
  fetchAndStoreCertificates,
} from "@ledgerhq/cal-interceptor";
import { type ContextModuleCalConfig } from "@ledgerhq/context-module";
import { Button, Divider, Flex, Input, Text } from "@ledgerhq/react-ui";

import { Block } from "@/components/Block";
import { useCalInterceptor } from "@/providers/CalInterceptorProvider";
import { selectCalConfig } from "@/state/settings/selectors";
import { setCalConfig } from "@/state/settings/slice";

export function ERC7730TesterDrawer() {
  const {
    isActive,
    startInterception,
    stopInterception,
    clearStoredDescriptors,
    getStoredDescriptorCount,
    interceptor,
  } = useCalInterceptor();
  const calConfig = useSelector(selectCalConfig);
  const dispatch = useDispatch();

  const setCalConfigFn = useCallback(
    (calConfig: ContextModuleCalConfig) => {
      dispatch(setCalConfig({ calConfig }));
    },
    [dispatch],
  );

  const [erc7730Input, setERC7730Input] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [descriptorCount, setDescriptorCount] = useState<number>(0);

  // Create ERC7730 client
  const client = useMemo(() => new ERC7730Client(), []);

  useEffect(() => {
    setDescriptorCount(getStoredDescriptorCount());
  }, [getStoredDescriptorCount]);

  // Set CAL config to test mode when interceptor becomes active
  useEffect(() => {
    if (isActive && calConfig.mode !== "test") {
      setCalConfigFn({
        ...calConfig,
        mode: "test",
      });
    }
  }, [isActive, calConfig, setCalConfigFn]);

  const addERC7730 = useCallback(async () => {
    if (!erc7730Input.trim() || !interceptor) {
      setError("Please enter ERC7730 descriptor");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Use the helper function to process and store descriptor
      await addERC7730Descriptor({
        descriptor: erc7730Input.trim(),
        interceptor,
        client,
        autoStart: true,
      });

      // Update UI state
      setDescriptorCount(getStoredDescriptorCount());
      setError(null);
      setERC7730Input("");
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      setError(`Failed to add ERC7730 descriptor: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, [erc7730Input, interceptor, client, getStoredDescriptorCount]);

  // Fetch and store certificates when interceptor becomes active
  useEffect(() => {
    if (isActive && interceptor) {
      const loadCertificates = async () => {
        try {
          console.log("Fetching CAL certificates...");
          await fetchAndStoreCertificates(interceptor, client);
          console.log("Certificates fetched and stored successfully");
        } catch (error) {
          console.error("Failed to fetch certificates:", error);
        }
      };

      loadCertificates();
    }
  }, [isActive, interceptor, client]);

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
    if (isActive) {
      stopInterception();
    }
  }, [clearStoredDescriptors, isActive, stopInterception]);

  return (
    <Block>
      <Flex flexDirection="column" rowGap={3} columnGap={3}>
        <Text variant="paragraph" fontWeight="medium">
          Request Interceptor
        </Text>
        <Flex flexDirection="row" flexWrap="wrap" rowGap={2} columnGap={2}>
          <Button
            variant={isActive ? "error" : "color"}
            onClick={toggleInterceptor}
          >
            {isActive ? "Disable CAL interceptor" : "Enable CAL interceptor"}
          </Button>
          <Button
            variant="main"
            onClick={handleClearDescriptors}
            disabled={descriptorCount === 0}
          >
            Clear {descriptorCount} Stored Descriptor
            {descriptorCount !== 1 ? "s" : ""}
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
