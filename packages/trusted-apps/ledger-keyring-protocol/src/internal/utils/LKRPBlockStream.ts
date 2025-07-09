import { Either, Just, Maybe, Nothing, Right } from "purify-ts";

import { type LKRPParsingError } from "@api/app-binder/Errors";

import { bytesToHex, hexToBytes } from "./hex";
import { LKRPBlock } from "./LKRPBlock";
import { TLVParser } from "./TLVParser";
import { CommandTags } from "./TLVTags";
import { type LKRPBlockData } from "./types";

export class LKRPBlockStream {
  private validation: Maybe<Promise<boolean>> = Nothing;
  private blocks: Maybe<Either<LKRPParsingError, LKRPBlock[]>> = Nothing;

  constructor(
    private readonly bytes: Uint8Array,
    blocks?: LKRPBlock[],
  ) {
    this.blocks = blocks ? Just(Right(blocks)) : Nothing;
  }

  static fromHex(hex: string): LKRPBlockStream {
    return new LKRPBlockStream(hexToBytes(hex));
  }

  static async fromData(
    blocksData: Omit<LKRPBlockData, "parent">[],
    parentHash?: string,
  ): Promise<LKRPBlockStream> {
    const blocks: LKRPBlock[] = [];
    let hash =
      parentHash ?? bytesToHex(crypto.getRandomValues(new Uint8Array(32)));

    for (const blockData of blocksData) {
      const block = LKRPBlock.fromData({
        ...blockData,
        parent: hash,
      });
      hash = await block.hash();
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
    return bytesToHex(this.bytes);
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
            if (nextBlock && (await block.hash()) !== nextBlock.parent) {
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
    return this.parse()
      .toMaybe()
      .chain((blocks) => Maybe.fromNullable(blocks[0]))
      .chain((block) => block.parse().toMaybe())
      .chain(({ commands }) => Maybe.fromNullable(commands[0]))
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
  }
}
