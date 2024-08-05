import { httpClientStubBuilder } from "../DefaultHttpClient.stub";
import { sessionStubBuilder } from "../model/Session.stub";
import { ConnectivityService } from "./ConnectivityService";

describe("ConnectivityService", () => {
  it("should be defined", () => {
    // given
    const client = httpClientStubBuilder();
    // when
    const connectivityService = new ConnectivityService({ client });
    // then
    expect(connectivityService).toBeInstanceOf(ConnectivityService);
  });
  it("should retrieve correct session", async () => {
    // given
    const id = "sessionId";
    const session = sessionStubBuilder({ id });
    const client = httpClientStubBuilder().mockResponse({
      method: "post",
      endpoint: "connect",
      response: session,
    });
    // when
    const connectivityService = new ConnectivityService({ client });
    // then
    expect(await connectivityService.connect(id)).toEqual(session);
  });
});
