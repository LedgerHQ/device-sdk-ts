export interface SignBlockHeaderCommandArgs {
  parent: Uint8Array;
  commandCount: number;
}

export type SignBlockHeaderCommandResponse = Uint8Array;
