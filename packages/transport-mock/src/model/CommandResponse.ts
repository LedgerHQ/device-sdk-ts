export type CommandResponseArgs = {
  readonly response: string;
};

export class CommandResponse {
  readonly response: string;

  constructor({ response }: CommandResponseArgs) {
    this.response = response;
  }
}
