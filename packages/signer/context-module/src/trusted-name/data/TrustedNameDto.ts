export type TrustedNameSignatures =
  | {
      prod: string;
      test?: string;
    }
  | {
      prod?: string;
      test: string;
    };

export type TrustedNameDescriptor = {
  data: string;
  signatures?: TrustedNameSignatures;
};

export type TrustedNameDto = {
  signedDescriptor: TrustedNameDescriptor;
};
