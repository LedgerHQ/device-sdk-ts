export class HexStringUtils {
  static stringToHex(str: string): string {
    let hexString = "";
    for (let i = 0; i < str.length; i++) {
      const hex = str.charCodeAt(i).toString(16);
      hexString += hex.padStart(2, "0"); // Ensure each hex code is at least 2 characters long
    }
    return hexString;
  }

  static appendSignatureToPayload(
    payload: string,
    signature: string,
    tag: string,
  ): string {
    // Ensure correct padding
    if (signature.length % 2 !== 0) {
      signature = "0" + signature;
    }
    // TLV encoding as according to trusted name documentation
    let signatureLength = (signature.length / 2).toString(16);
    if (signatureLength.length % 2 !== 0) {
      signatureLength = "0" + signatureLength;
    }

    return `${payload}${tag}${signatureLength}${signature}`;
  }
}
