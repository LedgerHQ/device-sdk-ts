import { injectable } from "inversify";

@injectable()
export class StubUseCase {
  execute = jest.fn(() => "stub");
}
