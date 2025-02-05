import { injectable } from "inversify";

@injectable()
export class StubUseCase {
  execute = vi.fn(() => "stub");
}
