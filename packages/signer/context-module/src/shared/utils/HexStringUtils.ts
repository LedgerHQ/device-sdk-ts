const HEX_RADIX = 16;
const HEX_BYTE_LENGTH = 2;

export class HexStringUtils {
  static stringToHex(str: string): string {
    let hexString = "";
    for (let i = 0; i < str.length; i++) {
      const hex = str.charCodeAt(i).toString(HEX_RADIX);
      hexString += hex.padStart(HEX_BYTE_LENGTH, "0");
    }
    return hexString;
  }

  static appendSignatureToPayload(
    payload: string,
    signature: string,
    tag: string,
  ): string {
    if (signature.length % HEX_BYTE_LENGTH !== 0) {
      signature = "0" + signature;
    }
    let signatureLength = (signature.length / HEX_BYTE_LENGTH).toString(
      HEX_RADIX,
    );
    if (signatureLength.length % HEX_BYTE_LENGTH !== 0) {
      signatureLength = "0" + signatureLength;
    }

    return `${payload}${tag}${signatureLength}${signature}`;
  }
}
