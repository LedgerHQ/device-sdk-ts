export class DerivationPathUtils {
  static PADDING = 0x80000000;
  static MAX_INDEX = 0x7fffffff;

  static splitPath(path: string): number[] {
    const result: number[] = [];
    const components = path.split("/");
    components.forEach((element) => {
      const hardened =
        element.length > 1 && element[element.length - 1] === "'";
      const raw = hardened ? element.slice(0, -1) : element;
      if (!/^\d+$/.test(raw)) {
        throw new Error("invalid number provided");
      }
      const index = BigInt(raw);
      if (index > BigInt(this.MAX_INDEX)) {
        throw new Error("BIP32 index out of range");
      }
      const number = Number(index);
      result.push(hardened ? number + this.PADDING : number);
    });
    return result;
  }
}
