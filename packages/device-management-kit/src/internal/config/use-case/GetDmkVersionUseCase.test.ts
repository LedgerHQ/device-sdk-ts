import { GetDmkVersionUseCase } from "./GetDmkVersionUseCase";

const getDmkConfigMock = vi.fn();

let usecase: GetDmkVersionUseCase;
describe("GetDmkVersionUseCase", () => {
  beforeEach(() => {
    getDmkConfigMock.mockClear();
    const configService = {
      getDmkConfig: getDmkConfigMock,
    };

    usecase = new GetDmkVersionUseCase(configService);
  });

  it("should return the dmk version", async () => {
    getDmkConfigMock.mockResolvedValue({
      name: "DeviceSDK",
      version: "1.0.0",
    });
    expect(await usecase.getDmkVersion()).toBe("1.0.0");
  });
});
