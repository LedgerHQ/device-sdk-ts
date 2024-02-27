import { Either } from "purify-ts";
import { v4 as uuidv4 } from "uuid";

export type SessionId = ReturnType<typeof uuidv4>;

/**
 * Represents a session with a device.
 */
// [TODO] replace this code with actual implementation
export class Session {
  id: SessionId;

  constructor() {
    this.id = uuidv4();
  }

  sendApdu(_args: Uint8Array): Promise<Either<Error, unknown>> {
    return Promise.resolve(Either.of("yolo"));
  }
}
