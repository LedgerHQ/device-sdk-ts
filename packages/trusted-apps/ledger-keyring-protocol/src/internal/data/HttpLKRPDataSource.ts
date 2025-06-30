import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { JWT } from "@api/app-binder/LKRPTypes";

import {
  AuthenticationPayload,
  Challenge,
  LKRPDataSource,
} from "./LKRPDataSource";

@injectable()
export class HttpLKRPDataSource implements LKRPDataSource {
  constructor(@inject("BaseUrl") private readonly baseUrl: string) {}

  private async request<Res>(
    endpoint: `/${string}`,
    jwt: { accessToken: string } | undefined,
    init?: RequestInit,
  ): Promise<Either<Error, Res>> {
    const href = this.baseUrl + endpoint;
    try {
      const response = await fetch(href, {
        ...init,
        headers: {
          ...init?.headers,
          "Content-Type": "application/json",
          ...(jwt ? { Authorization: `Bearer ${jwt.accessToken}` } : {}),
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

  authenticate(payload: AuthenticationPayload) {
    return this.request<JWT>("/authenticate", undefined, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  listTrustchains() {
    return Promise.resolve(Left(Error("Method not implemented.")));
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
