import { hexaStringToBuffer } from "@ledgerhq/device-management-kit";

import { LKRPMissingDataError } from "@api/app-binder/Errors";
import { KeypairFromBytes } from "@api/app-binder/KeypairFromBytes";
import { type Challenge } from "@internal/lkrp-datasource/data/LKRPDataSource";

import { SignChallengeWithKeypairTask } from "./SignChallengeWithKeypairTask";

describe("SignChallengeWithKeypairTask", () => {
  it("should sign a challenge with a keypair", async () => {
    // GIVEN
    const { challenge, keypair, trustchainId } = getParameters();

    // WHEN
    const task = new SignChallengeWithKeypairTask(keypair, trustchainId);
    const result = await task.run(challenge).run();

    // THEN
    expect(result.isRight()).toBe(true);
    result.ifRight((payload) => {
      expect(payload.challenge).toBe(challenge.json);
      expect(payload.signature.credential).toEqual({
        version: 0,
        curveId: 33,
        signAlgorithm: 1,
        publicKey: keypair.pubKeyToHex(),
      });
      expect(payload.signature.attestation).toBe(
        "0242303062373538386231393136633036373635343632656266343530363734346665323565643164623831393635326532646562613732313338393738396364633337",
      );
      expect(payload.signature.signature).toBe(
        "3045022100e9fead4e341f4e145f8888d7897184ff585e23c832a4c7acd15b5a2e53c58d2902204c58596d039960ab9b56ba4f9d27dbc5e647dbe779089e5e7e608501c5270049",
      );
    });
  });

  it("should handle invalid challenge", async () => {
    // GIVEN
    const { challenge, keypair, trustchainId } = getParameters({
      tlv: "invalid-tlv", // Invalid TLV
    });

    // WHEN
    const task = new SignChallengeWithKeypairTask(keypair, trustchainId);
    const result = await task.run(challenge).run();

    // THEN
    result.ifLeft((error) =>
      expect(error).toBeInstanceOf(LKRPMissingDataError),
    );
  });
});

function getParameters({
  privateKey = "b21ef366414b1aaba29b9576b7c1a661d663cfd8b4f998257dddbf7dc60d315d",
  trustchainId = "00b7588b1916c06765462ebf4506744fe25ed1db819652e2deba721389789cdc37",
  tlv = "0101070201001210bb1ea0c98526e1ea2deb7c7537f2989514010115473045022038632e8fa245483f0ecdbaa4ca0d455a03e7510da269d2089fed0d5cfa69d3d6022100c2f938d60bf1c34e96a2d332822a86059d90ec26ea222189cd9731834a5c151216046878ab74202b7472757374636861696e2d6261636b656e642e6170692e6177732e7374672e6c64672d746563682e636f6d320121332103cb7628e7248ddf9c07da54b979f16bf081fb3d173aac0992ad2a44ef6a388ae2600401000000",
} = {}) {
  return {
    challenge: { tlv, json: {} as Challenge["json"] },
    keypair: new KeypairFromBytes(hexaStringToBuffer(privateKey)!),
    trustchainId,
  };
}
