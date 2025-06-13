export type KeyPair = {
  pub: Uint8Array;
  priv: Uint8Array;
};

export type JWT = {
  exp: number;
};

export type Trustchain = {
  root: TreeNode;
};

export type TreeNode = {
  blocks: Block[];
  children: Map<string, TreeNode>;
};

export type Block = {
  version: number;
  parent: Uint8Array;
  issuer: Uint8Array;
  signature: Uint8Array;
  commands: Command[];
};

export type Command =
  | {
      type: "Seed";
      payload: {
        topic: Uint8Array | null;
        protocolVersion: number;
        groupKey: Uint8Array;
        initializationVector: Uint8Array;
        encryptedXpriv: Uint8Array;
        ephemeralPublicKey: Uint8Array;
      };
    }
  | {
      type: "Derive";
      payload: {
        path: number[];
        groupKey: Uint8Array;
        initializationVector: Uint8Array;
        encryptedXpriv: Uint8Array;
        ephemeralPublicKey: Uint8Array;
      };
    }
  | {
      type: "AddMember";
      payload: {
        name: string;
        publicKey: Uint8Array;
        permissions: number;
      };
    }
  | {
      type: "PublishKey";
      payload: {
        initializationVector: Uint8Array;
        encryptedXpriv: Uint8Array;
        recipient: Uint8Array;
        ephemeralPublicKey: Uint8Array;
      };
    }
  | {
      type: "EditMember";
      payload: {
        member: Uint8Array;
        name: string | null;
        permissions: number | null;
      };
    }
  | {
      type: "CloseStream";
      payload: null;
    };
