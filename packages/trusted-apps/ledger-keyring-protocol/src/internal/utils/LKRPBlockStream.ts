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
    private readonly bytes: Uint8Array,
    blocks?: LKRPBlock[],
  ) {
    this.blocks = blocks ? Just(Right(blocks)) : Nothing;
  }

  static fromHex(hex: string): LKRPBlockStream {
    return new LKRPBlockStream(hexaStringToBuffer(hex) ?? new Uint8Array());
  }

  static fromData(
    blocksData: Omit<LKRPBlockData, "parent">[],
    parentHash?: string,
  ): LKRPBlockStream {
    const blocks: LKRPBlock[] = [];
    let hash =
      parentHash ??
      bufferToHexaString(crypto.getRandomValues(new Uint8Array(32)), false);

    for (const blockData of blocksData) {
      const block = LKRPBlock.fromData({
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
    return new LKRPBlockStream(bytes, blocks);
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
        const start = parser.state.offset;
        const block = parser.parseBlockData().map((data) => {
          const end = parser.state.offset;
          return new LKRPBlock(this.bytes.slice(start, end), data);
        });
        parsed.push(block);
        if (block.isLeft()) break;
      }
      const blocks = Either.sequence(parsed);
      this.blocks = Just(blocks);
      return blocks;
    });
  }

  toHuman(): Either<LKRPParsingError, string> {
    return this.parse()
      .map((blocks) => blocks.map((block) => block.toHuman()))
      .chain(Either.sequence)
      .map((blocks) => blocks.join("\n\n"));
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

  async getPublishedKey(
    cryptoService: CryptoService,
    keypair: KeyPair,
  ): Promise<Maybe<PublishedKey>> {
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
      const key = cryptoService.importSymmetricKey(
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
