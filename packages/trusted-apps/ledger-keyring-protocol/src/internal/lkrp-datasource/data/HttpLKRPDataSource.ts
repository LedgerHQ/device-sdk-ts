import { inject, injectable } from "inversify";
import { EitherAsync, Just, Maybe, Nothing, Right } from "purify-ts";

import { LKRPHttpRequestError } from "@api/app-binder/Errors";
import { JWT } from "@api/app-binder/LKRPTypes";
import { lkrpDatasourceTypes } from "@internal/lkrp-datasource/di/lkrpDatasourceTypes";
import { LKRPBlock } from "@internal/utils/LKRPBlock";
import { LKRPBlockStream } from "@internal/utils/LKRPBlockStream";

import {
  AuthenticationPayload,
  Challenge,
  LKRPDataSource,
} from "./LKRPDataSource";

@injectable()
export class HttpLKRPDataSource implements LKRPDataSource {
  constructor(
    @inject(lkrpDatasourceTypes.BaseUrl) private readonly baseUrl: string,
  ) {}

  getChallenge() {
    return this.request<Challenge>("/challenge", Nothing);
  }

  authenticate(payload: AuthenticationPayload) {
    return this.request<JWT>("/authenticate", Nothing, {
      method: "POST",
      body: JSON.stringify(payload),
    }).map((jwt) => ({
      jwt,
      trustchainId: Maybe.fromNullable(
        Object.keys(jwt.permissions).find((id) =>
          Boolean(jwt.permissions[id]?.["m/"]),
        ),
      ),
    }));
  }

  getTrustchainById(id: string, jwt: JWT) {
    return this.request<{ [path: string]: string }>(
      `/trustchain/${id}`,
      Just(jwt),
    ).map((serialized) =>
      Object.fromEntries(
        Object.entries(serialized).map(([path, stream]) => [
          path,
          LKRPBlockStream.fromHex(stream),
        ]),
      ),
    );
  }

  postDerivation(id: string, stream: LKRPBlockStream, jwt: JWT) {
    return this.request<void>(`/trustchain/${id}/derivation`, Just(jwt), {
      method: "POST",
      body: JSON.stringify(stream.toString()),
    });
  }

  putCommands(id: string, path: string, block: LKRPBlock, jwt: JWT) {
    return this.request<void>(`/trustchain/${id}/commands`, Just(jwt), {
      method: "PUT",
      body: JSON.stringify({ path, blocks: [block.toString()] }),
    });
  }

  private request<Res>(
    endpoint: `/${string}`,
    jwt: Maybe<{ access_token: string }>,
    init?: RequestInit,
  ): EitherAsync<LKRPHttpRequestError, Res> {
    const href = this.baseUrl + endpoint;

    return EitherAsync.fromPromise(async () => {
      const response = await fetch(href, {
        ...init,
        headers: {
          ...init?.headers,
          "Content-Type": "application/json",
          ...jwt.mapOrDefault<{ Authorization?: string }>(
            ({ access_token }) => ({ Authorization: `Bearer ${access_token}` }),
            {},
          ),
        },
      });
      if (!response.ok) {
        throw new LKRPHttpRequestError(
          `Failed to fetch ${href}: [${response.status}] ${response.statusText}`,
        );
      }
      if (response.status === 204) return Right(undefined as Res);
      return Right((await response.json()) as Res);
    }).mapLeft((error: unknown) =>
      error instanceof LKRPHttpRequestError
        ? error
        : new LKRPHttpRequestError(error),
    );
  }
}
