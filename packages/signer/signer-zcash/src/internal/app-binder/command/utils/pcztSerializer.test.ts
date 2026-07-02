import { describe, expect, it } from "vitest";

import {
  PCZT_MAX_PACKET_SIZE,
  PCZT_P1,
  PCZT_P2,
} from "@internal/app-binder/command/utils/apduHeaderUtils";
import {
  pcztP1,
  pcztP2,
  serializeOrchardActions,
  serializePcztHeader,
  serializeTransparentInputs,
  serializeTransparentOutputs,
} from "@internal/app-binder/command/utils/pcztSerializer";
import {
  bytes,
  bytesToHex,
  hexToBytes,
  ORCHARD_ENC_CIPHERTEXT_SIZE,
  SAMPLE_GLOBAL,
  SAMPLE_HEADER_HEX,
  sampleOrchardBundle,
  sampleTransparentInput,
  sampleTransparentOutput,
} from "@internal/app-binder/task/__fixtures__/pcztFixtures";
import { concatUint8Arrays } from "@internal/utils/concatUint8Arrays";

describe("pcztSerializer", () => {
  describe("serializePcztHeader", () => {
    it("serializes the header + globals byte-for-byte (little-endian)", () => {
      expect(bytesToHex(serializePcztHeader(SAMPLE_GLOBAL))).toBe(
        SAMPLE_HEADER_HEX,
      );
    });

    it("encodes an absent fallback_lock_time as a single 0x00 tag", () => {
      const hex = bytesToHex(
        serializePcztHeader({ ...SAMPLE_GLOBAL, fallbackLockTime: null }),
      );
      // ...consensus_branch_id, then 0x00 (absent), then expiry_height...
      expect(hex).toContain("b4d0d6c200" + "00000000");
    });
  });

  describe("serializeTransparentInputs", () => {
    it("emits only a CompactSize 0 count packet when empty", () => {
      const packets = serializeTransparentInputs([]);
      expect(packets).toHaveLength(1);
      expect(bytesToHex(packets[0]!)).toBe("00");
    });

    it("serializes one input: count, small fields, script, sighash+bip32", () => {
      const input = sampleTransparentInput();
      const packets = serializeTransparentInputs([input]);

      expect(packets).toHaveLength(4);
      expect(bytesToHex(packets[0]!)).toBe("01");

      // prevout(36) + sequence Option<u32>(present) + value u64 LE.
      const expectedSmall = concatUint8Arrays(
        bytes(32, 0x11),
        hexToBytes("00000000"), // prevout_index 0
        hexToBytes("01ffffffff"), // sequence present, 0xffffffff
        hexToBytes("e803000000000000"), // value 1000 LE
      );
      expect(bytesToHex(packets[1]!)).toBe(bytesToHex(expectedSmall));

      // script packet: CompactSize length + scriptPubKey (25 bytes -> 0x19).
      expect(bytesToHex(packets[2]!)).toBe(
        "19" + bytesToHex(input.scriptPubKey),
      );

      // sighash(0x01) + bip32: count(1) + pubkey[33] + fingerprint[32] + path.
      const deriv = packets[3]!;
      expect(deriv[0]).toBe(0x01); // sighash_type SIGHASH_ALL
      expect(deriv[1]).toBe(0x01); // bip32 entry count
      expect(bytesToHex(deriv.subarray(2, 35))).toBe(
        bytesToHex(bytes(33, 0x02)),
      );
      // path "44'/133'/0'/0/0": len 5, then BE u32 components.
      expect(bytesToHex(deriv.subarray(67))).toBe(
        "05" + "8000002c" + "80000085" + "80000000" + "00000000" + "00000000",
      );
    });
  });

  describe("serializeTransparentOutputs", () => {
    it("emits only a CompactSize 0 count packet when empty", () => {
      const packets = serializeTransparentOutputs([]);
      expect(packets).toHaveLength(1);
      expect(bytesToHex(packets[0]!)).toBe("00");
    });

    it("serializes one output: count, value, script, empty bip32", () => {
      const output = sampleTransparentOutput();
      const packets = serializeTransparentOutputs([output]);

      expect(packets).toHaveLength(4);
      expect(bytesToHex(packets[0]!)).toBe("01");
      expect(bytesToHex(packets[1]!)).toBe("8403000000000000"); // value 900 LE
      expect(bytesToHex(packets[2]!)).toBe(
        "19" + bytesToHex(output.scriptPubKey),
      );
      expect(bytesToHex(packets[3]!)).toBe("00"); // bip32 entry count 0 (no derivation)
    });
  });

  describe("serializeOrchardActions", () => {
    it("emits only a CompactSize 0 count packet when empty", () => {
      const packets = serializeOrchardActions({
        actions: [],
        flags: 0,
        valueBalance: 0n,
        anchor: bytes(32, 0x00),
      });
      expect(packets).toHaveLength(1);
      expect(bytesToHex(packets[0]!)).toBe("00");
    });

    it("serializes one action with the full packet sequence + trailer", () => {
      const packets = serializeOrchardActions(sampleOrchardBundle());

      // count + [spend, zip32, outputSmall, enc x3, out, metadata] + trailer.
      expect(packets).toHaveLength(10);
      expect(bytesToHex(packets[0]!)).toBe("01");

      // spend small fields: cv|nullifier|rk|recipient|value8|rho|rseed|alpha.
      const spend = packets[1]!;
      expect(spend).toHaveLength(32 * 3 + 43 + 8 + 32 * 3);
      expect(spend[32 * 3 + 43]).toBe(0x05); // spend_value first LE byte

      // zip32: fingerprint[32] + path("44'/133'/0'": len 3 + 3 BE u32).
      expect(bytesToHex(packets[2]!)).toBe(
        bytesToHex(bytes(32, 0x00)) +
          "03" +
          "8000002c" +
          "80000085" +
          "80000000",
      );

      // every emitted packet stays within the APDU payload cap.
      packets.forEach((packet) => {
        expect(packet.length).toBeLessThanOrEqual(PCZT_MAX_PACKET_SIZE);
      });
    });

    it("splits a large enc_ciphertext across multiple <=255B packets", () => {
      const packets = serializeOrchardActions(sampleOrchardBundle());
      // enc field occupies packets[4..6] (CompactSize 580 + 580 bytes = 583).
      const encField = concatUint8Arrays(packets[4]!, packets[5]!, packets[6]!);
      // strip the 3-byte CompactSize prefix (0xfd + u16 LE).
      expect(bytesToHex(encField.subarray(0, 3))).toBe("fd4402");
      expect(encField.length - 3).toBe(ORCHARD_ENC_CIPHERTEXT_SIZE);
      expect(bytesToHex(encField.subarray(3))).toBe(
        bytesToHex(bytes(ORCHARD_ENC_CIPHERTEXT_SIZE, 0xaa)),
      );
    });

    it("encodes a negative value_balance with the sign flag set", () => {
      const packets = serializeOrchardActions({
        ...sampleOrchardBundle(),
        valueBalance: -7n,
      });
      const trailer = packets[packets.length - 1]!;
      // flags(1) + |value_sum| u64 LE + sign(1) + anchor[32].
      expect(trailer[0]).toBe(0x02); // flags
      expect(trailer[1]).toBe(0x07); // |−7| first LE byte
      expect(trailer[9]).toBe(0x01); // negative sign flag
    });
  });

  describe("framing", () => {
    it("pcztP1 marks first / continuation / last packets", () => {
      expect(pcztP1(0, 1)).toBe(PCZT_P1.FIRST);
      expect(pcztP1(0, 3)).toBe(PCZT_P1.FIRST);
      expect(pcztP1(1, 3)).toBe(PCZT_P1.NEXT);
      expect(pcztP1(2, 3)).toBe(PCZT_P1.LAST);
    });

    it("pcztP2 sets FINISHED only on the final packet when requested", () => {
      expect(pcztP2(2, 3, true)).toBe(PCZT_P2.FINISHED);
      expect(pcztP2(1, 3, true)).toBe(PCZT_P2.CONTINUE);
      expect(pcztP2(2, 3, false)).toBe(PCZT_P2.CONTINUE);
    });
  });
});
