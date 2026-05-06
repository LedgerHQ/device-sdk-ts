export type SafeAccountDto = {
  accountDescriptor: SafeDescriptorDto;
  signersDescriptor: SafeDescriptorDto;
};

export type SafeDescriptorDto = {
  signedDescriptor: string;
  keyId: string;
  keyUsage: string;
};
