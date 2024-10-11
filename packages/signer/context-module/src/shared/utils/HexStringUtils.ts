export class HexStringUtils {
  static stringToHex(str: string): string {
    let hexString = "";
    for (let i = 0; i < str.length; i++) {
      const hex = str.charCodeAt(i).toString(16);
      hexString += hex.padStart(2, "0"); // Ensure each hex code is at least 2 characters long
    }
    return hexString;
  }
}
