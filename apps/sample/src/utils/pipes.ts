/* eslint-disable @typescript-eslint/no-explicit-any */

export const asyncPipe =
  (...fns: Array<(arg: any) => any>) =>
  (input: any): Promise<any> =>
    fns.reduce(
      (chain, func) => Promise.resolve(chain).then(func),
      Promise.resolve(input),
    );

export const pipe =
  (...fns: Array<(arg: any) => any>) =>
  (input: any): any =>
    fns.reduce((chain, func) => func(chain), input);
