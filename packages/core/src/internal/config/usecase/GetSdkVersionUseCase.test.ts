import { GetSDKVersionUseCase } from "./GetSdkVersionUseCase";

const getSdkVersionMock = jest.fn();

let usecase: GetSDKVersionUseCase;
describe("GetSdkVersionUseCase", () => {
  beforeEach(() => {
    getSdkVersionMock.mockClear();
    const configService = {
      getSdkVersion: getSdkVersionMock,
    };

    usecase = new GetSDKVersionUseCase(configService);
  });

  it("should return the sdk version", async () => {
    getSdkVersionMock.mockResolvedValue("1.0.0");
    expect(await usecase.getSdkVersion()).toBe("1.0.0");
  });
});
