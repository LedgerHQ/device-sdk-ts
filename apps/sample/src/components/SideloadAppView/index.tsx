import React, { useCallback, useRef, useState } from "react";
import {
  GetOsVersionCommand,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { Button, Flex, Icons, InfiniteLoader, Text } from "@ledgerhq/react-ui";

import { Block } from "@/components/Block";
import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { type ApduSender, sideloadApp } from "@/utils/sideloadApp";

import { DropZone, HiddenInput, ProgressFill, ProgressTrack } from "./styles";

type SideloadProgress = {
  phase: string;
  pct: number;
};

export const SideloadAppView: React.FC<{ sessionId: string }> = ({
  sessionId,
}) => {
  const dmk = useDmk();

  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<SideloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectFile = useCallback((file: File | null) => {
    setError(null);
    setSuccess(false);
    setProgress(null);
    if (file && !file.name.toLowerCase().endsWith(".hex")) {
      setError("Please select a .hex file");
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!loading) setIsDragging(true);
    },
    [loading],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (loading) return;
      selectFile(e.dataTransfer.files[0] ?? null);
    },
    [loading, selectFile],
  );

  const handleClick = useCallback(() => {
    if (!loading) fileInputRef.current?.click();
  }, [loading]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      selectFile(e.target.files?.[0] ?? null);
    },
    [selectFile],
  );

  const handleSideload = useCallback(async () => {
    if (!selectedFile) return;

    setLoading(true);
    setError(null);
    setSuccess(false);
    setProgress(null);

    try {
      const hexContent = await selectedFile.text();

      const osResult = await dmk.sendCommand({
        sessionId,
        command: new GetOsVersionCommand(),
      });
      if (!isSuccessCommandResult(osResult)) {
        throw new Error(
          `Failed to read device OS version: ${JSON.stringify(osResult.error)}`,
        );
      }

      const sendApdu: ApduSender = async (apdu) => {
        const resp = await dmk.sendApdu({ sessionId, apdu });
        const result = new Uint8Array(resp.data.length + 2);
        result.set(resp.data);
        result[resp.data.length] = resp.statusCode[0]!;
        result[resp.data.length + 1] = resp.statusCode[1]!;
        return result;
      };

      await sideloadApp(
        sendApdu,
        hexContent,
        {
          appName: selectedFile.name.replace(/\.hex$/i, ""),
          targetId: osResult.data.targetId,
          apiLevel: 0,
          dataLength: 0,
          installParamsSize: 0,
          flags: 0,
          mainAddress: 0,
        },
        (phase, pct) => setProgress({ phase, pct }),
      );

      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [selectedFile, dmk, sessionId]);

  return (
    <Flex flexDirection="column" rowGap={4} p={6} maxWidth={600}>
      <Text variant="h4">Sideload App</Text>
      <Text variant="body" color="neutral.c70">
        Select a .hex file and sideload it onto the connected device over the
        secure channel.
      </Text>
      <Block>
        <DropZone
          isDragging={isDragging}
          disabled={loading}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
          data-testid="dropzone_sideload-app"
        >
          <HiddenInput
            ref={fileInputRef}
            type="file"
            accept=".hex"
            onChange={handleFileChange}
            disabled={loading}
          />
          <Flex flexDirection="column" alignItems="center" rowGap={3}>
            <Icons.CloudUpload size="L" />
            <Text variant="body">
              {selectedFile
                ? selectedFile.name
                : "Drop a .hex file here or click to select"}
            </Text>
          </Flex>
        </DropZone>

        <Button
          variant="main"
          disabled={!selectedFile || loading}
          onClick={handleSideload}
          Icon={() =>
            loading ? <InfiniteLoader size={20} /> : <Icons.ArrowRight />
          }
          data-testid="CTA_sideload-application"
        >
          Sideload Application
        </Button>

        {progress && (
          <Flex flexDirection="column" rowGap={2}>
            <ProgressTrack>
              <ProgressFill pct={progress.pct} />
            </ProgressTrack>
            <Text variant="small" color="neutral.c70">
              {progress.phase} ({Math.round(progress.pct)}%)
            </Text>
          </Flex>
        )}

        {error && (
          <Text color="error.c80" data-testid="text_sideload-error">
            {error}
          </Text>
        )}

        {success && (
          <Text color="success.c80" data-testid="text_sideload-success">
            App sideloaded successfully.
          </Text>
        )}
      </Block>
    </Flex>
  );
};
