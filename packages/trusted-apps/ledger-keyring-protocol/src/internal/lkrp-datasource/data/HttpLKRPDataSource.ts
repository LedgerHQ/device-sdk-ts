import { inject, injectable } from "inversify";
import { Either, Left, Maybe, Right } from "purify-ts";

import { JWT } from "@api/app-binder/LKRPTypes";
import { lkrpDatasourceTypes } from "@internal/lkrp-datasource/di/lkrpDatasourceTypes";
import { Block } from "@internal/utils/Block";

import {
  AuthenticationPayload,
  Challenge,
  ListTrustchainsResponse,
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

  authenticate(payload: AuthenticationPayload) {
    return this.request<JWT>("/authenticate", undefined, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getTruschainId(jwt: JWT) {
    const trustchains = await this.request<ListTrustchainsResponse>(
      "/trustchains",
      jwt,
    );
    return trustchains.map((data) =>
      Maybe.fromNullable(
        Object.keys(data).find((id) => Boolean(data[id]?.["m/"])),
      ),
    );
  }

  async getTrustchainById(id: string, jwt: JWT) {
    // const response = await this.request<{ [path: string]: string }>(
    //   `/trustchain/${id}`,
    //   jwt,
    // );
    // const trustchain = response.map((serialized) =>
    //   Object.fromEntries(
    //     Object.entries(serialized).map(([path, stream]) => [
    //       path,
    //       Block.fromHex(stream),
    //     ]),
    //   ),
    // );
    // return Promise.resolve(trustchain);
    return Promise.resolve(Left(Error("Method not implemented.")));
  }

  async postDerivation() {
    return Promise.resolve(Left(Error("Method not implemented.")));
  }

  async putCommands() {
    return Promise.resolve(Left(Error("Method not implemented.")));
  }
}
