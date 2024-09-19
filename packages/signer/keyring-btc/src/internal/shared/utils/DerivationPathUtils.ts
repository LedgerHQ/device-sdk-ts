// TODO: Move to shared package and use in both keyring-btc and keyring-eth

export class DerivationPathUtils {
  private static readonly PADDING = 0x80000000;

  static splitPath(path: string): number[] {
    const result: number[] = [];
    const components = path.split("/");
    components.forEach((element) => {
      let number = parseInt(element, 10);
      if (isNaN(number)) {
        throw new Error("Invalid number provided");
      }
      if (element.length > 1 && element[element.length - 1] === "'") {
        number += this.PADDING;
      }
      result.push(number);
    });
    return result;
  }
}
