import { Maybe } from "purify-ts";

import { type CryptoService } from "@api/index";

import { LKRPBlockStream } from "./LKRPBlockStream";

export class Trustchain {
  constructor(
    private readonly cryptoService: CryptoService,
    private readonly id: string,
    private readonly serialized: {
      [path: string]: string;
    },
  ) {}

  getId(): string {
    return this.id;
  }

  getRootStream(): Maybe<LKRPBlockStream> {
    return this.getStream("m/");
  }

  getAppStream(appId: number): Maybe<LKRPBlockStream> {
    return this.getStream(`m/${appId}'`);
  }

  getStream(path: string): Maybe<LKRPBlockStream> {
    return Maybe.fromNullable(this.serialized[path]).map(
      LKRPBlockStream.fromHex,
    );
  }
}
