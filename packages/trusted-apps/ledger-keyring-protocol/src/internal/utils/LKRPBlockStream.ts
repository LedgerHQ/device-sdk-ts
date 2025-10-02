import {
  bufferToHexaString,
  hexaStringToBuffer,
} from "@ledgerhq/device-management-kit";
import { Either, Just, Maybe, MaybeAsync, Nothing, Right } from "purify-ts";

import { type CryptoService, EncryptionAlgo } from "@api/crypto/CryptoService";
import { type KeyPair } from "@api/crypto/KeyPair";
import { type LKRPParsingError } from "@api/model/Errors";
import { type LKRPBlockData } from "@internal/models/LKRPBlockTypes";
import { CommandTags } from "@internal/models/Tags";
import {
  type EncryptedPublishedKey,
  type PublishedKey,
} from "@internal/models/Types";

import { LKRPBlock } from "./LKRPBlock";
import { TLVParser } from "./TLVParser";

export class LKRPBlockStream {
  private validation: Maybe<Promise<boolean>> = Nothing;
  private blocks: Maybe<Either<LKRPParsingError, LKRPBlock[]>> = Nothing;
  private path: Maybe<string> = Nothing;

  constructor(
    private readonly cryptoService: CryptoService,
    private readonly bytes: Uint8Array,
    blocks?: LKRPBlock[],
  ) {
    this.blocks = blocks ? Just(Right(blocks)) : Nothing;
  }

  static fromHex(cryptoService: CryptoService, hex: string): LKRPBlockStream {
    return new LKRPBlockStream(
      cryptoService,
      hexaStringToBuffer(hex) ?? new Uint8Array(),
    );
  }

  static fromData(
    cryptoService: CryptoService,
    blocksData: Omit<LKRPBlockData, "parent">[],
    parentHash?: string,
  ): LKRPBlockStream {
    const blocks: LKRPBlock[] = [];
    let hash =
      parentHash ??
      bufferToHexaString(crypto.getRandomValues(new Uint8Array(32)), false);

    for (const blockData of blocksData) {
      const block = LKRPBlock.fromData(cryptoService, {
        ...blockData,
        parent: hash,
      });
      hash = block.hash();
      blocks.push(block);
    }
    const bytes = blocks.reduce(
      (acc, block) => new Uint8Array([...acc, ...block.toU8A()]),
      new Uint8Array(),
    );
    return new LKRPBlockStream(cryptoService, bytes, blocks);
  }

  toU8A(): Uint8Array {
    return this.bytes;
  }

  toString(): string {
    return bufferToHexaString(this.bytes, false);
  }

  parse(): Either<LKRPParsingError, LKRPBlock[]> {
    return this.blocks.orDefaultLazy(() => {
      const parser = new TLVParser(this.bytes);
      const parsed: Either<LKRPParsingError, LKRPBlock>[] = [];
      while (!parser.state.isDone) {
        const block = LKRPBlock.fromParser(this.cryptoService, parser);
        parsed.push(block);
        if (block.isLeft()) break;
      }
      const blocks = Either.sequence(parsed);
      this.blocks = Just(blocks);
      return blocks;
    });
  }

  async toHuman(): Promise<Either<string, string>> {
    const isValid = await this.validate();
    return this.parse()
      .mapLeft(
        (err) => err.originalError?.toString() ?? "Unknown parsing error",
      )
      .map((blocks) => blocks.map((block) => block.toHuman()))
      .chain((blocks) =>
        Either.sequence(blocks)
          .mapLeft(() => blocks.map((block) => block.extract()))
          .bimap(stringifyBlocks(false), stringifyBlocks(true)),
      );

    function stringifyBlocks(success: boolean) {
      return (blocks: string[]) =>
        [
          `(parsed: ${success}, isValid: ${isValid}):`,
          blocks
            .map((block, index) =>
              `Block ${index} ${block}`
                .split("\n")
                .map((l) => `  ${l}`)
                .join("\n"),
            )
            .join("\n\n"),
        ].join("\n");
    }
  }

  async validate(streamParentHash?: string): Promise<boolean> {
    return this.validation.orDefaultLazy(async () => {
      const validation = this.parse()
        .map((blocks) =>
          blocks.map((block) =>
            block
              .parse()
              .map(({ parent }) => ({ parent, hash: () => block.hash() })),
          ),
        )
        .chain(Either.sequence)
        .toMaybe()
        .map(async (blocks) => {
          if (
            streamParentHash &&
            blocks[0] &&
            streamParentHash !== blocks[0].parent
          ) {
            return false;
          }

          for await (const [index, block] of blocks.entries()) {
            const nextBlock = blocks[index + 1];
            if (nextBlock && block.hash() !== nextBlock.parent) {
              return false;
            }
          }
          return true;
        })
        .orDefault(Promise.resolve(false));

      return validation;
    });
  }

  getPath(): Maybe<string> {
    this.path.ifNothing(() => {
      this.path = this.parse()
        .toMaybe()
        .chainNullable((blocks) => blocks[0])
        .chain((block) => block.parse().toMaybe())
        .chainNullable(({ commands }) => commands[0])
        .chain((command) => command.parse().toMaybe())
        .chain((data) => {
          switch (data.type) {
            case CommandTags.Derive:
              return Just(data.path);
            case CommandTags.Seed:
              return Just("m/0'");
            default:
              return Nothing;
          }
        });
    });
    return this.path;
  }

  getMemberBlock(member: string): Maybe<LKRPBlockData> {
    return this.parse()
      .toMaybe()
      .chain((blocks) => {
        for (const block of blocks) {
          const parsedBlock = block.parse();
          if (parsedBlock.isRight()) {
            const blockData = parsedBlock.extract();
            for (const command of blockData.commands) {
              const pubkey = command.getPublicKey();
              if (pubkey.isJust() && pubkey.extract() === member) {
                return Maybe.of(blockData);
              }
            }
          }
        }
        return Nothing;
      });
  }

  hasMember(member: string): boolean {
    return this.getMemberBlock(member).isJust();
  }

  async getPublishedKey(keypair: KeyPair): Promise<Maybe<PublishedKey>> {
    return MaybeAsync.liftMaybe(
      this.getMemberBlock(keypair.getPublicKeyToHex()).chain(
        (block): Maybe<EncryptedPublishedKey> => {
          for (const command of block.commands) {
            const key = command.getEncryptedPublishedKey();
            if (key.isJust()) {
              return key;
            }
          }
          return Nothing;
        },
      ),
    ).map(async (published) => {
      const secret = (
        await keypair.deriveSharedSecret(published.ephemeralPublicKey)
      ).slice(1);
      const key = this.cryptoService.importSymmetricKey(
        secret,
        EncryptionAlgo.AES256_GCM,
      );
      const xpriv = await key.decrypt(
        published.initializationVector,
        published.encryptedXpriv,
      );
      return { privateKey: xpriv.slice(0, 32), chainCode: xpriv.slice(32) };
    });
  }
}
