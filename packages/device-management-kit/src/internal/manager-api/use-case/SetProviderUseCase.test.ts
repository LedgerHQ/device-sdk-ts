import { describe, expect, it, vi } from "vitest";

import { type ManagerApiDataSource } from "@internal/manager-api/data/ManagerApiDataSource";

import { SetProviderUseCase } from "./SetProviderUseCase";

describe("SetProviderUseCase", () => {
  it("should call setProvider on ManagerApiDataSource with the correct provider", () => {
    const mockManagerApiDataSource: ManagerApiDataSource = {
      setProvider: vi.fn(),
    } as unknown as ManagerApiDataSource;
    const useCase = new SetProviderUseCase(mockManagerApiDataSource);
    const provider = 123;
    useCase.execute(provider);
    expect(mockManagerApiDataSource.setProvider).toHaveBeenCalledWith(provider);
  });
});
