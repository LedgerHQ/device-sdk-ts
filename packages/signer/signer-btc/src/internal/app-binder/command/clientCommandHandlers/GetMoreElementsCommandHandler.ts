import {
  type CommandHandler,
  type CommandHandlerContext,
} from "./ClientCommandHandlerTypes";

export class GetMoreElementsCommandHandler implements CommandHandler {
  execute(request: Uint8Array, context: CommandHandlerContext): Uint8Array {
    if (request.length !== 1) {
      //temp error
      throw new Error("Invalid GET_MORE_ELEMENTS request length");
    }

    if (context.queue.length === 0) {
      //temp error
      throw new Error("No more elements in queue");
    }

    const elementSize = context.queue[0]?.length;
    if (elementSize === undefined) {
      //temp error
      throw new Error("Queue is empty");
    }
    if (!context.queue.every((e) => e.length === elementSize)) {
      //temp error
      throw new Error("Elements in queue have varying lengths");
    }

    const maxPayloadSize = 255 - 1 - 1;
    const maxN = Math.floor(maxPayloadSize / elementSize);
    const n = Math.min(maxN, context.queue.length);

    const response = new Uint8Array(1 + 1 + n * elementSize);
    let offset = 0;
    response[offset++] = n;
    response[offset++] = elementSize;

    for (let i = 0; i < n; i++) {
      const element = context.queue[i];
      if (element) {
        response.set(element, offset);
        offset += elementSize;
      }
    }

    context.queue.splice(0, n);

    return response;
  }
}
