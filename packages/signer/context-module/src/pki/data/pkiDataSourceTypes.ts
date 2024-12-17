export type PkiCertificateRequestDto = {
  output: string;
  target_device: string;
  not_valid_after: string;
  latest: boolean;
  descriptor: string;
};

export type PkiCertificateResponseDto = {
  id: string;
  target_device: string;
  not_valid_after: string;
  public_key_usage: string;
  certificate_version: string;
  descriptor: string;
};
