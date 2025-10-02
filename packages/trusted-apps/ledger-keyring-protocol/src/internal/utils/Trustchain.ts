import { Either, EitherAsync, Maybe } from "purify-ts";

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
    return Maybe.fromNullable(this.serialized[path]).map((hex) =>
      LKRPBlockStream.fromHex(this.cryptoService, hex),
    );
  }

  async toHuman(): Promise<Either<string, string>> {
    const streams = await Promise.all(
      Object.keys(this.serialized).map((path) =>
        EitherAsync.liftEither(
          this.getStream(path).toEither(`${path} doesn't exist`),
        )
          .mapLeft((error) => [path, `  Error: ${error}`].join("\n"))
          .chain((stream) => stream.toHuman())
          .bimap(
            (data) => `${path} ${data}`,
            (data) => `${path}${data}`,
          )
          .run(),
      ),
    );

    const value = streams.map((entry) => entry.extract()).join("\n\n");
    return Either.sequence(streams).bimap(
      () => value,
      () => value,
    );
  }
}
