import { type AppConfiguration } from "@api/model/AppConfiguration";
import { PublicKeyDisplayMode } from "@api/model/PublicKeyDisplayMode";
import { type SolanaAppBinder } from "@internal/app-binder/SolanaAppBinder";

import { GetAppConfigurationUseCase } from "./GetAppConfigurationUseCase";

describe("GetAppConfigurationUseCase", () => {
  const getAppConfigurationMock = jest.fn();
  const config: AppConfiguration = {
    blindSigningEnabled: false,
    pubKeyDisplayMode: PublicKeyDisplayMode.LONG,
    version: "1.0.0",
  };
  const appBinderMock = {
    getAppConfiguration: getAppConfigurationMock,
  } as unknown as SolanaAppBinder;
  let useCase: GetAppConfigurationUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new GetAppConfigurationUseCase(appBinderMock);
  });

  it("should return the config from the appBinder's getAppConfiguration method", () => {
    // GIVEN
    getAppConfigurationMock.mockReturnValue(config);

    // WHEN
    const result = useCase.execute();

    // THEN
    expect(getAppConfigurationMock).toHaveBeenCalledWith();
    expect(result).toEqual(config);
  });
});
