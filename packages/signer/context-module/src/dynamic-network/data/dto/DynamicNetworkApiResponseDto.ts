export type DynamicNetworkApiResponseDto = Array<{
  id: string;
  descriptors: Record<
    string,
    {
      data: string;
      descriptorType: string;
      descriptorVersion: string;
      signatures: {
        prod: string;
        test: string;
      };
    }
  >;
  icons: Record<string, string>;
}>;
