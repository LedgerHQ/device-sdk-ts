import type {
  DataPathElement,
  DataPathElementSlice,
  GenericPath,
} from "@ledgerhq/context-module";
import {
  ContainerPath,
  DataPathElementType,
  DataPathLeafType,
} from "@ledgerhq/context-module";
import {
  bufferToHexaString,
  ByteArrayBuilder,
  ByteArrayParser,
  hexaStringToBuffer,
} from "@ledgerhq/device-management-kit";
import { Transaction } from "ethers";
import { injectable } from "inversify";
import { Either, Left, Maybe, Right } from "purify-ts";

/**
 * The goal of this service it to implement the GenericPath parser in the context
 * of an ethereum transaction.
 *
 * The abi of an ethereum transaction calldata is specified here:
 * https://docs.soliditylang.org/en/latest/abi-spec.html
 *
 * To be noted:
 *  - calldata is composed of:
 *    - the selector on 4 bytes
 *    - chunks of 32 bytes, whatever the size of the item contained in that chunk
 *    - static elements (fixed size) are encoded "in-place", always in 1 chunk padded with zeros
 *      (even a bool is on 32 bytes)
 *    - dynamic elements (variable size) are behind references (pointers) and then encoded with length+value
 *
 * Examples extracted from the abi specification:
 *  - example for a function with static elements:
 *    signature: baz(uint32 x, bool y)
 *    parameters: x = 69
 *                y = true
 *    - Encoding:
 *      0xcdcd77c0: the selector
 *      [0] 0x0000000000000000000000000000000000000000000000000000000000000045: value = 69
 *      [1] 0x0000000000000000000000000000000000000000000000000000000000000001: value = true
 *
 *  - example for a function with dynamic elements:
 *    signature: g(uint256[][] x, string[] x)
 *    parameters: x = [[1, 2], [3]]
 *                y = ["one", "two", "three"]
 *    - Encoding:
 *      0x2289b18c: the selector
 *      [0] 0x0000000000000000000000000000000000000000000000000000000000000040: offset of x
 *      [1] 0x0000000000000000000000000000000000000000000000000000000000000140: offset of y
 *      [2] 0x0000000000000000000000000000000000000000000000000000000000000002: length of x
 *      [3] 0x0000000000000000000000000000000000000000000000000000000000000040: offset of x[0]
 *      [4] 0x00000000000000000000000000000000000000000000000000000000000000a0: offset of x[1]
 *      [5] 0x0000000000000000000000000000000000000000000000000000000000000002: length of x[0]
 *      [6] 0x0000000000000000000000000000000000000000000000000000000000000001: value of x[0][0] = 1
 *      [7] 0x0000000000000000000000000000000000000000000000000000000000000002: value of x[0][1] = 2
 *      [8] 0x0000000000000000000000000000000000000000000000000000000000000001: length of x[1]
 *      [9] 0x0000000000000000000000000000000000000000000000000000000000000003: value of x[1][0] = 3
 *      [10] 0x0000000000000000000000000000000000000000000000000000000000000003: length of y
 *      [11] 0x0000000000000000000000000000000000000000000000000000000000000060: offset of y[0]
 *      [12] 0x00000000000000000000000000000000000000000000000000000000000000a0: offset of y[1]
 *      [13] 0x00000000000000000000000000000000000000000000000000000000000000e0: offset of y[2]
 *      [14] 0x0000000000000000000000000000000000000000000000000000000000000003: length of y[0]
 *      [15] 0x6f6e650000000000000000000000000000000000000000000000000000000000: value of y[0] = "one"
 *      [16] 0x0000000000000000000000000000000000000000000000000000000000000003: length of y[1]
 *      [17] 0x74776f0000000000000000000000000000000000000000000000000000000000: value of y[1] = "two"
 *      [18] 0x0000000000000000000000000000000000000000000000000000000000000005: length of y[2]
 *      [19] 0x7468726565000000000000000000000000000000000000000000000000000000: value of y[2] = "three"
 */
const SELECTOR_LENGTH = 4;
const CHUNK_SIZE = 32;

@injectable()
export class TransactionParserService {
  public extractValue(
    serializedTransaction: Uint8Array,
    path: GenericPath,
  ): Either<Error, Uint8Array[]> {
    return Either.encase(() =>
      Transaction.from(bufferToHexaString(serializedTransaction)),
    ).chain((transaction) => {
      /**
       * We can first check container paths, which are in the transaction envelop
       */
      if (path === ContainerPath.FROM) {
        // 'from' is not part of the unsigned ethereum transaction, and can
        // only by recovered from the transaction signature later on.
        // Therefore we cannot extract it from a transaction before signing it.
        // It is not an issue since that field will typically be displayed as an
        // address on the device and therefore don't require additional descriptors.
        return Left(
          new Error("Cannot get 'FROM' field of an unsigned transaction"),
        );
      } else if (path === ContainerPath.TO) {
        return Maybe.fromNullable(transaction.to)
          .map((str) => hexaStringToBuffer(str))
          .filter((bytes) => bytes !== null)
          .map((bytes) => [bytes])
          .toEither(new Error("Faild to extract TO field of transaction"));
      } else if (path === ContainerPath.VALUE) {
        return Maybe.fromNullable(transaction.value)
          .map((num) => new ByteArrayBuilder().add256BitUIntToData(num).build())
          .map((bytes) => [bytes])
          .toEither(new Error("Faild to extract VALUE field of transaction"));
      }

      /**
       * If it was not a path in the container, it means it's a path in the calldata
       */
      return Maybe.fromNullable(transaction.data)
        .toEither(new Error("Transaction calldata is empty"))
        .chain((calldata) =>
          Maybe.fromNullable(hexaStringToBuffer(calldata)).toEither(
            new Error(`Invalid hex string calldata: ${calldata}`),
          ),
        )
        .chain((calldata) => this.extractCalldataValue(calldata, path));
    });
  }

  private extractCalldataValue(
    data: Uint8Array,
    path: DataPathElement[],
  ): Either<Error, Uint8Array[]> {
    data = data.slice(SELECTOR_LENGTH); // Remove the selector from the calldata
    if (path.length === 0) {
      return Left(new Error("Path is empty"));
    }
    return this.extractCalldataValueAt(data, path, 0, 0);
  }

  private extractCalldataValueAt(
    data: Uint8Array,
    path: DataPathElement[],
    offset: number,
    parentOffset: number,
  ): Either<Error, Uint8Array[]> {
    // If the path ends with a slice, store it now as it is only allowed at the end of a binary path.
    const lastElement = path[path.length - 1]!;
    const leafSlice: DataPathElementSlice | null =
      lastElement.type === DataPathElementType.SLICE ? lastElement : null;

    while (path.length > 0) {
      const element = path[0]!;
      path = path.slice(1);
      switch (element.type) {
        case DataPathElementType.TUPLE:
          // A tuple contain 1 element per chunk
          parentOffset = offset;
          offset += element.offset * CHUNK_SIZE;
          break;
        case DataPathElementType.ARRAY:
          // An array contains a length, followed by the list of elements.
          // See the examples with dynamic types at the top of this file for more informations.
          return this.getU256(data.slice(offset))
            .toEither(new Error(`Invalid array length at offset ${offset}`))
            .chain((length) => {
              // Skip the array length
              offset += CHUNK_SIZE;
              parentOffset = offset;
              // Select the array slice to iterate on
              const start =
                element.start === undefined
                  ? 0
                  : element.start < 0
                    ? length + element.start
                    : element.start;
              const end =
                element.end === undefined
                  ? length
                  : element.end < 0
                    ? length + element.end
                    : element.end;
              if (
                start < 0 ||
                start >= length ||
                end > length ||
                start >= end
              ) {
                return Left(
                  new Error(
                    `Array slice out of bounds, start=${element.start}, end=${element.end}`,
                  ),
                );
              }
              // Iterate on the array slice
              return Array.from({ length: end - start }, (_, i) => i)
                .map(
                  (i) => offset + (i + start) * element.itemSize * CHUNK_SIZE,
                )
                .reduce(
                  (acc: Either<Error, Uint8Array[]>, arrayOffset) =>
                    acc.chain((values) =>
                      this.extractCalldataValueAt(
                        data,
                        path,
                        arrayOffset,
                        parentOffset,
                      ).map((newValues) => [...values, ...newValues]),
                    ),
                  Right([]),
                );
            });
        case DataPathElementType.REF:
          // A reference means the current slot points to a new offset in the calldata (a kind of pointer).
          // That offset is relative to its 'parent' element, here named parentOffset.
          // See the examples with dynamic types at the top of this file for more informations.
          if (
            this.getU256(data.slice(offset))
              .ifJust((reference) => (offset = parentOffset + reference))
              .isNothing()
          ) {
            return Left(new Error(`Invalid ref at offset ${offset}`));
          }
          break;
        case DataPathElementType.LEAF:
          // A leaf means we reached the end of the path.
          // We have to check the leaf type to know how to extract the data.
          switch (element.leafType) {
            case DataPathLeafType.ARRAY_LEAF:
              return Left(
                new Error("Array leaf is not supported in v1 of protocol"),
              );
            case DataPathLeafType.TUPLE_LEAF:
              return Left(
                new Error("Tuple leaf is not supported in v1 of protocol"),
              );
            case DataPathLeafType.STATIC_LEAF:
              // A static leaf is the chunk of current offset (data of static size)
              return this.getSlice(data, offset, CHUNK_SIZE).chain((leaf) => {
                if (leafSlice === null) {
                  return Right([leaf]);
                } else {
                  return this.sliceLeaf(leaf, leafSlice);
                }
              });
            case DataPathLeafType.DYNAMIC_LEAF:
              // A dynamic leaf is composed of a length followed by the actual value
              // (data of variable size such as a string).
              // See the examples with dynamic types at the top of this file for more informations.
              return this.getU256(data.slice(offset))
                .toEither(new Error(`Invalid leaf length at offset ${offset}`))
                .chain((length) => {
                  // Skip dynamic leaf length
                  offset += CHUNK_SIZE;
                  return this.getSlice(data, offset, length).chain((leaf) => {
                    if (leafSlice === null) {
                      return Right([leaf]);
                    } else {
                      return this.sliceLeaf(leaf, leafSlice);
                    }
                  });
                });
          }
          break;
        case DataPathElementType.SLICE:
          // If the last element was a slice, it was already popped at the beginning of this function
          return Left(
            new Error("Slice can only be used as last element of the path"),
          );
      }
    }
    // We should have early-returned on a leaf
    return Left(new Error("Path did not resolve to a leaf element"));
  }

  private sliceLeaf(
    data: Uint8Array,
    leafSlice: DataPathElementSlice,
  ): Either<Error, Uint8Array[]> {
    const length = data.length;
    const start =
      leafSlice.start === undefined
        ? 0
        : leafSlice.start < 0
          ? length + leafSlice.start
          : leafSlice.start;
    const end =
      leafSlice.end === undefined
        ? length
        : leafSlice.end < 0
          ? length + leafSlice.end
          : leafSlice.end;
    if (start >= end) {
      return Left(new Error(`invalid leaf slice: start ${start}, end ${end}`));
    }
    return this.getSlice(data, start, end - start).map((leaf) => [leaf]);
  }

  getSlice(
    data: Uint8Array,
    offset: number,
    size: number,
  ): Either<Error, Uint8Array> {
    return offset < 0 || data.length < offset + size
      ? Left(
          new Error(
            `calldata too small to slice at offset ${offset} of length ${size}`,
          ),
        )
      : Right(data.slice(offset, offset + size));
  }

  getU256(data: Uint8Array): Maybe<number> {
    // https://docs.soliditylang.org/en/latest/abi-spec.html#formal-specification-of-the-encoding
    return Maybe.fromNullable(new ByteArrayParser(data).extract256BitUInt(true))
      .filter((res) => res <= Number.MAX_SAFE_INTEGER)
      .map((res) => Number(res));
  }
}
