import { GetSdkVersionUseCase } from "./GetSdkVersionUseCase";

const getSdkConfigMock = jest.fn();

let usecase: GetSdkVersionUseCase;
describe("GetSdkVersionUseCase", () => {
  beforeEach(() => {
    getSdkConfigMock.mockClear();
    const configService = {
      getSdkConfig: getSdkConfigMock,
    };

    usecase = new GetSdkVersionUseCase(configService);
  });

  it("should return the sdk version", async () => {
    getSdkConfigMock.mockResolvedValue({
      name: "DeviceSDK",
      version: "1.0.0-mock.1",
    });
    expect(await usecase.getSdkVersion()).toBe("1.0.0-mock.1");
  });
});
