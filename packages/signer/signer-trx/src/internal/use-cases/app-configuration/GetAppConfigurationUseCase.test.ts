import { type TronAppBinder } from "@internal/app-binder/TronAppBinder";

import { GetAppConfigurationUseCase } from "./GetAppConfigurationUseCase";

describe("GetAppConfigurationUseCase", () => {
  const returnedValue = { observable: {}, cancel: vi.fn() };
  const getAppConfigurationMock = vi.fn().mockReturnValue(returnedValue);
  const appBinderMock = {
    getAppConfiguration: getAppConfigurationMock,
  } as unknown as TronAppBinder;
  let useCase: GetAppConfigurationUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new GetAppConfigurationUseCase(appBinderMock);
  });

  it("should call getAppConfiguration on the app binder", () => {
    // WHEN
    const result = useCase.execute();

    // THEN
    expect(result).toEqual(returnedValue);
    expect(getAppConfigurationMock).toHaveBeenCalledWith();
  });
});
