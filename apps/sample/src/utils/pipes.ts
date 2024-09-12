export const asyncPipe =
  (...fns: Array<(arg: any) => any>) =>
  async (input: any): Promise<any> =>
    fns.reduce((chain, fun) => chain.then(fun), Promise.resolve(input));

export const pipe =
  (...fns: Array<(arg: any) => any>) =>
  (input: any): any =>
    fns.reduce((chain, fun) => fun(chain), input);
