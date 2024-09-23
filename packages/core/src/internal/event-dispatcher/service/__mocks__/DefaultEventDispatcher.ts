export class DefaultEventDispatcher {
  get = jest.fn();
  listen = jest.fn();
  dispatch = jest.fn();
  close = jest.fn();
}
