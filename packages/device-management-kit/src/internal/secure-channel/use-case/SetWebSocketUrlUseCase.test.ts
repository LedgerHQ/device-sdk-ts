import { describe, expect, it, vi } from "vitest";

import { type SecureChannelDataSource } from "@internal/secure-channel/data/SecureChannelDataSource";

import { SetWebSocketUrlUseCase } from "./SetWebSocketUrlUseCase";

describe("SetWebSocketUrlUseCase", () => {
  const mockSecureChannelDataSource: SecureChannelDataSource = {
    setWebSocketUrl: vi.fn(),
  } as unknown as SecureChannelDataSource;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call setWebSocketUrl on SecureChannelDataSource with the given URL", () => {
    const useCase = new SetWebSocketUrlUseCase(mockSecureChannelDataSource);
    const webSocketUrl = "wss://custom-websocket.url/update";

    useCase.execute(webSocketUrl);

    expect(mockSecureChannelDataSource.setWebSocketUrl).toHaveBeenCalledWith(
      webSocketUrl,
    );
  });
});
