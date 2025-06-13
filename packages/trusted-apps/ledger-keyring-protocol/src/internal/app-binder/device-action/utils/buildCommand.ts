import { TLVBuilder } from "./TLVBuilder";

export function buildCommand(command: Command) {
  switch (command.type) {
    case "Seed": {
      // https://ledgerhq.atlassian.net/wiki/spaces/TA/pages/4105207815/ARCH+LKRP+-+v1+specifications#Seed-(0x10)
      const payload = command.payload;
      return new TLVBuilder()
        .addBytes(payload.topic ?? new Uint8Array([]))
        .addVarInt(payload.protocolVersion, 2)
        .addPublicKey(payload.groupKey)
        .addBytes(payload.initializationVector)
        .addBytes(payload.encryptedXpriv)
        .addPublicKey(payload.ephemeralPublicKey)
        .build();
    }

    case "AddMember": {
      // https://ledgerhq.atlassian.net/wiki/spaces/TA/pages/4105207815/ARCH+LKRP+-+v1+specifications#AddMember-(0x11)
      const payload = command.payload;
      return new TLVBuilder()
        .addString(payload.name)
        .addPublicKey(payload.publicKey)
        .addVarInt(payload.permissions, 4)
        .build();
    }

    case "PublishKey": {
      // https://ledgerhq.atlassian.net/wiki/spaces/TA/pages/4105207815/ARCH+LKRP+-+v1+specifications#PublishKey-(0x12)
      const payload = command.payload;
      return new TLVBuilder()
        .addBytes(payload.initializationVector)
        .addBytes(payload.encryptedXpriv)
        .addPublicKey(payload.recipient)
        .addPublicKey(payload.ephemeralPublicKey)
        .build();
    }

    case "CloseStream": {
      // https://ledgerhq.atlassian.net/wiki/spaces/TA/pages/4105207815/ARCH+LKRP+-+v1+specifications#CloseStream-(0x13)
      return new Uint8Array();
    }

    case "EditMember": {
      // https://ledgerhq.atlassian.net/wiki/spaces/TA/pages/4105207815/ARCH+LKRP+-+v1+specifications#EditMember-(0x14)
      const payload = command.payload;
      return new TLVBuilder()
        .addPublicKey(payload.member)
        .with((builder) =>
          payload.permissions
            ? builder.addVarInt(payload.permissions, 4)
            : builder.addNull(),
        )
        .with((builder) =>
          payload.name ? builder.addString(payload.name) : builder.addNull(),
        )
        .build();
    }

    case "Derive": {
      // https://ledgerhq.atlassian.net/wiki/spaces/TA/pages/4105207815/ARCH+LKRP+-+v1+specifications#Derive-(0x15)
      const payload = command.payload;
      return new TLVBuilder()
        .addBytes(payload.path)
        .addPublicKey(payload.groupKey)
        .addBytes(payload.initializationVector)
        .addBytes(payload.encryptedXpriv)
        .addPublicKey(payload.ephemeralPublicKey)
        .build();
    }
  }
}
