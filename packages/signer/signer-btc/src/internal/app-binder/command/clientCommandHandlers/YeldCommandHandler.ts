import {
  type CommandHandler,
  type CommandHandlerContext,
} from "./ClientCommandHandlerTypes";

export class YieldCommandHandler implements CommandHandler {
  execute(request: Uint8Array, context: CommandHandlerContext): Uint8Array {
    const data = request.slice(1);
    context.yieldedResults.push(data);
    return new Uint8Array([]);
  }
}
