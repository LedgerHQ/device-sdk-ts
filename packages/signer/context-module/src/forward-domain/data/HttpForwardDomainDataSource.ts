import axios from "axios";
import { injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import {
  ForwardDomainDataSource,
  GetForwardDomainInfosParams,
} from "@/forward-domain/data/ForwardDomainDataSource";
import PACKAGE from "@root/package.json";

@injectable()
export class HttpForwardDomainDataSource implements ForwardDomainDataSource {
  public async getDomainNamePayload({
    domain,
    challenge,
  }: GetForwardDomainInfosParams): Promise<Either<Error, string>> {
    try {
      const response = await axios.request<{ payload: string }>({
        method: "GET",
        url: `https://nft.api.live.ledger.com/v1/names/ens/forward/${domain}?challenge=${challenge}`,
        headers: {
          "X-Ledger-Client-Version": `context-module/${PACKAGE.version}`,
        },
      });

      return response.data.payload
        ? Right(response.data.payload)
        : Left(
            new Error(
              "[ContextModule] HttpForwardDomainDataSource: error getting domain payload",
            ),
          );
    } catch (error) {
      return Left(
        new Error(
          "[ContextModule] HttpForwardDomainDataSource: Failed to fetch domain name",
        ),
      );
    }
  }
}
