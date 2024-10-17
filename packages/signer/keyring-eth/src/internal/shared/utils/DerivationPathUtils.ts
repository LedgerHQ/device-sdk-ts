// TODO: Move to shared package and use in both keyring-btc and keyring-eth

import { ByteArrayBuilder } from "@ledgerhq/device-management-kit";

export class DerivationPathUtils {
  static PADDING = 0x80000000;

  static splitPath(path: string): number[] {
    const result: number[] = [];
    const components = path.split("/");
    components.forEach((element) => {
      let number = parseInt(element, 10);
      if (isNaN(number)) {
        throw new Error("invalid number provided");
      }
      if (element.length > 1 && element[element.length - 1] === "'") {
        number += this.PADDING;
      }
      result.push(number);
    });
    return result;
  }

  static addDerivationPath(
    builder: ByteArrayBuilder,
    derivationPath: string,
  ): ByteArrayBuilder {
    const paths = DerivationPathUtils.splitPath(derivationPath);
    builder.add8BitUIntToData(paths.length);
    paths.forEach((path) => {
      builder.add32BitUIntToData(path);
    });
    return builder;
  }
}
