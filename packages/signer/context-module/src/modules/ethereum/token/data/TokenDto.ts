export type TokenSignatures =
  | {
      prod: string;
      test?: string;
    }
  | {
      prod?: string;
      test: string;
    };

export type TokenDescriptor = {
  data: string;
  signatures: TokenSignatures;
};

export type TokenDto = {
  ticker: string;
  descriptor: TokenDescriptor;
};
