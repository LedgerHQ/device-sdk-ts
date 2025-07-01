import { inject, injectable } from "inversify";
import { Either, Left, Maybe, Right } from "purify-ts";

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

  private async request<Res>(
    endpoint: `/${string}`,
    jwt: { access_token: string } | undefined,
    init?: RequestInit,
  ): Promise<Either<Error, Res>> {
    const href = this.baseUrl + endpoint;
    try {
      const response = await fetch(href, {
        ...init,
        headers: {
          ...init?.headers,
          "Content-Type": "application/json",
          ...(jwt ? { Authorization: `Bearer ${jwt.access_token}` } : {}),
        },
      });
      if (!response.ok) {
        return Promise.resolve(
          Left(
            new Error(
              `Failed to fetch ${href}: [${response.status}] ${response.statusText}`,
            ),
          ),
        );
      }
      const data: Res = (await response.json()) as Res;
      return Promise.resolve(Right(data));
    } catch (error) {
      if (error instanceof Error) {
        return Promise.resolve(Left(error));
      }
      return Promise.resolve(
        Left(new Error(`Failed to fetch ${href}: ${String(error)}`)),
      );
    }
  }

  getChallenge() {
    return this.request<Challenge>("/challenge", undefined);
  }

  async authenticate(payload: AuthenticationPayload) {
    const response = await this.request<JWT>("/authenticate", undefined, {
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
    return Promise.resolve(Left(Error("Method not implemented.")));
  }

  async postDerivation() {
    return Promise.resolve(Left(Error("Method not implemented.")));
  }

  async putCommands() {
    return Promise.resolve(Left(Error("Method not implemented.")));
  }
}
