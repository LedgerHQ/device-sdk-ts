export type MockArgs = {
  readonly prefix: string;
  readonly response: string;
};

export class Mock {
  readonly prefix: string;
  readonly response: string;

  constructor({ prefix, response }: MockArgs) {
    this.prefix = prefix;
    this.response = response;
  }
}
