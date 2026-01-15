import { DeviceExchangeError } from "@ledgerhq/device-management-kit";

import {
  COSMOS_APP_ERRORS,
  CosmosAppCommandError,
  type CosmosAppErrorCodes,
} from "./CosmosAppErrors";

describe("CosmosAppCommandError", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  afterAll(() => {
    vi.resetModules();
  });

  it("should be an instance of DeviceExchangeError", () => {
    const error = new CosmosAppCommandError({
      message: "Test error message",
      errorCode: "6400",
    });

    expect(error).toBeInstanceOf(DeviceExchangeError);
  });

  it("should set the correct message when provided", () => {
    const customMessage = "Custom error message";
    const error = new CosmosAppCommandError({
      message: customMessage,
      errorCode: "6400",
    });

    expect(error.message).toBe(customMessage);
  });

  it("should set the correct customErrorCode", () => {
    const errorCode: CosmosAppErrorCodes = "6984";
    const error = new CosmosAppCommandError({
      message: "Data Invalid",
      errorCode,
    });

    expect(error.errorCode).toBe(errorCode);
  });

  it("should correlate error codes with messages from cosmosAppErrors", () => {
    const errorCode: CosmosAppErrorCodes = "698A";
    const expectedMessage = COSMOS_APP_ERRORS[errorCode].message;

    const error = new CosmosAppCommandError({
      message: expectedMessage,
      errorCode,
    });

    expect(error.errorCode).toBe(errorCode);
    expect(error.message).toBe(expectedMessage);

    expect(error).toBeInstanceOf(DeviceExchangeError);
  });
});
