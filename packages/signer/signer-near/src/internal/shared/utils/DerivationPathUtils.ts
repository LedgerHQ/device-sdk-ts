export class DerivationPathUtils {
  static PADDING = 0x80000000;

  static splitPath(path: string): number[] {
    const parts = path.split("/");
    return parts.map((part) => {
      return part.endsWith(`'`)
        ? this.PADDING + Math.abs(parseInt(part.slice(0, -1)))
        : this.PADDING + Math.abs(parseInt(part));
    });
  }
}
