import { type Either } from "purify-ts";

import { type AuthenticateDAError } from "@api/index";
import {
  type AuthenticationPayload,
  type AuthenticationResponse,
  type Challenge,
  type LKRPDataSource,
} from "@internal/lkrp-datasource/data/LKRPDataSource";

export class AuthenticateTask {
  run(
    lkrpDataSource: LKRPDataSource,
    signerTask: {
      run: (
        challenge: Challenge,
      ) => PromiseLike<Either<AuthenticateDAError, AuthenticationPayload>>;
    },
  ): Promise<Either<AuthenticateDAError, AuthenticationResponse>> {
    return lkrpDataSource
      .getChallenge()
      .chain((challenge) => signerTask.run(challenge))
      .chain((payload) => lkrpDataSource.authenticate(payload))
      .run();
  }
}
