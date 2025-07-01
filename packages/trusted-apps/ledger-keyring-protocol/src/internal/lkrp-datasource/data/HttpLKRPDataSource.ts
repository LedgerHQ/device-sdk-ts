import { inject, injectable } from "inversify";
import { Either, Left, Maybe, Nothing, Right } from "purify-ts";

import { LKRPHttpRequestError } from "@api/app-binder/Errors";
import { JWT } from "@api/app-binder/LKRPTypes";
import { lkrpDatasourceTypes } from "@internal/lkrp-datasource/di/lkrpDatasourceTypes";

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

  async authenticate(payload: AuthenticationPayload) {
    const response = await this.request<JWT>("/authenticate", Nothing, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return response.map((jwt) => ({
      jwt,
      trustchainId: Maybe.fromNullable(
        Object.keys(jwt.permissions).find((id) =>
          Boolean(jwt.permissions[id]?.["m/"]),
        ),
      ),
    }));
  }

  async getTrustchainById() {
    return Promise.resolve(
      Left(new LKRPHttpRequestError("Method not implemented.")),
    );
  }

  async postDerivation() {
    return Promise.resolve(
      Left(new LKRPHttpRequestError("Method not implemented.")),
    );
  }

  async putCommands() {
    return Promise.resolve(
      Left(new LKRPHttpRequestError("Method not implemented.")),
    );
  }

  private async request<Res>(
    endpoint: `/${string}`,
    jwt: Maybe<{ access_token: string }>,
    init?: RequestInit,
  ): Promise<Either<LKRPHttpRequestError, Res>> {
    const href = this.baseUrl + endpoint;
    try {
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
        return Promise.resolve(
          Left(
            new LKRPHttpRequestError(
              `Failed to fetch ${href}: [${response.status}] ${response.statusText}`,
            ),
          ),
        );
      }
      const data: Res = (await response.json()) as Res;
      return Promise.resolve(Right(data));
    } catch (error) {
      if (error instanceof Error) {
        return Promise.resolve(Left(new LKRPHttpRequestError(error)));
      }
      return Promise.resolve(
        Left(
          new LKRPHttpRequestError(`Failed to fetch ${href}: ${String(error)}`),
        ),
      );
    }
  }
}
