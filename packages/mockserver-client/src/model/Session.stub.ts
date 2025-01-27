import { deviceStubBuilder } from "./Device.stub";
import { Session, type SessionArgs } from "./Session";

export const sessionStubBuilder = (args: Partial<SessionArgs> = {}) =>
  new Session({
    id: "21",
    device: deviceStubBuilder(),
    current_app: "BOLOS",
    created_at: Date.now().valueOf(),
    ...args,
  });
