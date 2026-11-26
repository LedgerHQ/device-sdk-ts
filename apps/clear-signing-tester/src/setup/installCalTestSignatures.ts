import { createECDH, createPrivateKey, sign } from "node:crypto";

// TEMPORARY: CAL serves the EIP-712 V2 descriptors on staging `next` only, signed
// with its test key only. Until they reach `main` with production signatures, the
// tester runs on a Speculos trusting the test PKI, with CAL's certificates re-keyed
// to the CAL test key and re-signed with the Speculos test root, as
// `apps/sample/api/index.py` does. Revert the commit adding this file to go back
// to production CAL.
const CAL_TEST_PUBLIC_KEY =
  "0320da62003c0ce097e33644a10fe4c30454069a4454f0fa9d4e84f45091429b52";
const SPECULOS_TEST_ROOT_PRIVATE_KEY =
  "f7aeb3d0f44f1bf50d89a1996bbb2bf0544dce2e0a2d0ff67eea0fa9c750f3d0";
const SECP256K1_ORDER = BigInt(
  "0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141",
);

const testRootKey = (() => {
  const ecdh = createECDH("secp256k1");
  ecdh.setPrivateKey(Buffer.from(SPECULOS_TEST_ROOT_PRIVATE_KEY, "hex"));
  const pub = ecdh.getPublicKey();
  return createPrivateKey({
    format: "jwk",
    key: {
      kty: "EC",
      crv: "secp256k1",
      d: Buffer.from(SPECULOS_TEST_ROOT_PRIVATE_KEY, "hex").toString(
        "base64url",
      ),
      x: pub.subarray(1, 33).toString("base64url"),
      y: pub.subarray(33).toString("base64url"),
    },
  });
})();

const derInteger = (value: bigint): string => {
  let hex = value.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  if (parseInt(hex.slice(0, 2), 16) & 0x80) hex = `00${hex}`;
  return `02${(hex.length / 2).toString(16).padStart(2, "0")}${hex}`;
};

const signWithTestRoot = (data: string): string => {
  const raw = sign("sha256", Buffer.from(data, "hex"), {
    key: testRootKey,
    dsaEncoding: "ieee-p1363",
  }).toString("hex");
  const r = BigInt(`0x${raw.slice(0, 64)}`);
  let s = BigInt(`0x${raw.slice(64)}`);
  if (s > SECP256K1_ORDER / 2n) s = SECP256K1_ORDER - s;
  const body = derInteger(r) + derInteger(s);
  return `30${(body.length / 2).toString(16).padStart(2, "0")}${body}`;
};

type CalCertificate = {
  public_key: string;
  descriptor: { data: string; signatures: Record<string, string> };
};

const originalFetch = globalThis.fetch;

globalThis.fetch = async (input, init) => {
  const url = new URL(
    typeof input === "string" || input instanceof URL ? input : input.url,
  );
  if (!url.pathname.endsWith("/certificates")) {
    return originalFetch(input, init);
  }
  url.searchParams.set("output", "descriptor,public_key");
  const certificates = (await (
    await originalFetch(url, init)
  ).json()) as CalCertificate[];
  for (const certificate of certificates) {
    const data = certificate.descriptor.data.replace(
      new RegExp(certificate.public_key, "i"),
      CAL_TEST_PUBLIC_KEY,
    );
    const signature = signWithTestRoot(data);
    certificate.descriptor = {
      data,
      signatures: { prod: signature, test: signature },
    };
  }
  return Response.json(certificates);
};
