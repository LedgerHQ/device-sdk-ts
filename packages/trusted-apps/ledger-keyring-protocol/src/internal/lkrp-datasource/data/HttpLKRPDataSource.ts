import { inject, injectable } from "inversify";
import { EitherAsync, Just, Left, Maybe, Nothing, Right } from "purify-ts";

import {
  LKRPDataSourceError,
  LKRPDataSourceErrorStatus,
} from "@api/app-binder/Errors";
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

  postDerivation(id: string, block: LKRPBlock, jwt: JWT) {
    return this.request<void>(`/trustchain/${id}/derivation`, Just(jwt), {
      method: "POST",
      body: JSON.stringify(block.toString()),
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
  ): EitherAsync<LKRPDataSourceError, Res> {
    const href = this.baseUrl + endpoint;
    const headers = {
      ...init?.headers,
      "Content-Type": "application/json",
      ...jwt.mapOrDefault<{ Authorization?: string }>(
        ({ access_token }) => ({ Authorization: `Bearer ${access_token}` }),
        {},
      ),
    };

    return EitherAsync(() => fetch(href, { ...init, headers }))
      .mapLeft((err) => ({
        status: "UNKNOWN" as const,
        message: (err as Partial<Error>).message || "Unknown error",
      }))
      .chain(async (response) => {
        switch (response.status) {
          case 204:
            return Right(undefined as Res);

          default:
            return EitherAsync(() => response.json())
              .mapLeft((err) => (err as Partial<Error>).message)
              .map((data) =>
                response.ok
                  ? Right(data as Res)
                  : Left((data as { message?: string }).message),
              )
              .chain(EitherAsync.liftEither)
              .mapLeft((message) => ({
                status: statusMap.get(response.status) ?? "UNKNOWN",
                message: `[${response.status}] ${message || response.statusText}`,
              }));
        }
      })
      .mapLeft(
        ({ status, message }) =>
          new LKRPDataSourceError({
            status,
            message: `${message ?? "Unknown error"} (from: ${href})`,
          }),
      );
  }
}

const statusMap = new Map<unknown, LKRPDataSourceErrorStatus>([
  [400, "BAD_REQUEST"],
  [401, "UNAUTHORIZED"],
]);
