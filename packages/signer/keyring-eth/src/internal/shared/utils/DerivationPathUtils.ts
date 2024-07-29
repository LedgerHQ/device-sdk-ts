export class DerivationPathUtils {
  static splitPath(path: string): number[] {
    const result: number[] = [];
    const components = path.split("/");
    components.forEach((element) => {
      let number = parseInt(element, 10);
      if (isNaN(number)) {
        throw new Error("invalid number provided");
      }
      if (element.length > 1 && element[element.length - 1] === "'") {
        number += this.padding;
      }
      result.push(number);
    });
    return result;
  }

  static padding = 0x80000000;
}
