import { inject, injectable } from "inversify";

import { types as deviceSessionTypes } from "@internal/device-session/di/deviceSessionTypes";
import { SessionId } from "@internal/device-session/model/Session";
import { DefaultSessionService } from "@internal/device-session/service/DefaultSessionService";

export type SendApduUseCaseArgs = {
  sessionId: SessionId;
  apdu: Uint8Array;
};

/**
 * Sends an APDU to a connected device.
 */
@injectable()
export class SendApduUseCase {
  constructor(
    @inject(deviceSessionTypes.SessionService)
    private sessionService: DefaultSessionService,
    // @inject(loggerTypes.LoggerService) private logger: LoggerService,
  ) {}

  async execute({ sessionId }: SendApduUseCaseArgs): Promise<unknown> {
    // [TODO] implement logging
    // [SHOULD] this is temporary example code, to de replaced with actual implementation
    const uint8Array = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00]);
    const deviceSession = this.sessionService.getSession(sessionId);
    if (deviceSession.isLeft()) {
      throw deviceSession.extract();
    }

    if (deviceSession.isRight()) {
      const res = await deviceSession.extract().sendApdu(uint8Array);
      return res;
    }

    return;
  }
}
