export class Mock {
  prefix: string;
  response: string;

  constructor(
    prefix: string,
    response: string,
  ) {
    this.prefix = prefix;
    this.response = response;
  }
}
