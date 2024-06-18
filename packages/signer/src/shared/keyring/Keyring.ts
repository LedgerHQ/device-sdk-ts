export interface Keyring {
  signTransaction: <Transaction, Options, Signature>(
    derivationPath: string,
    transaction: Transaction,
    options: Options,
  ) => Promise<Signature>;
  signMessage: <Message, Options, Signature>(
    derivationPath: string,
    message: Message,
    options: Options,
  ) => Promise<Signature>;
  getAddress: <Options, Response>(
    derivationPath: string,
    options: Options,
  ) => Promise<Response>;
}
