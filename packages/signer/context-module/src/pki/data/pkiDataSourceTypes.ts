export type PkiCertificateRequestDto = {
  public_key_id: string | undefined;
  public_key_usage: string;
  output: string;
  target_device: string;
  latest: boolean;
};

export type PkiCertificateResponseDto = {
  id: string;
  target_device: string;
  not_valid_after: string;
  public_key_usage: string;
  certificate_version: string;
  descriptor: {
    data: string;
    descriptorType: string;
    signatures: {
      prod: string;
      test: string;
    };
  };
};
