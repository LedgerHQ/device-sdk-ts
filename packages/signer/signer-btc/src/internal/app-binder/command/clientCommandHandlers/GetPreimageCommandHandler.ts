import { encodeVarint } from "@internal/utils/Varint";

import {
  type CommandHandler,
  type CommandHandlerContext,
} from "./ClientCommandHandlerTypes";

export class GetPreimageCommandHandler implements CommandHandler {
  execute(request: Uint8Array, context: CommandHandlerContext): Uint8Array {
    const hash = request.slice(2, 34);
    const maybePreimage = context.dataStore.getPreimage(hash);

    if (maybePreimage.isJust()) {
      const preimage = maybePreimage.extract();
      const preimageLenVarint = encodeVarint(preimage.length).unsafeCoerce();
      const maxPayloadSize = 255 - preimageLenVarint.length - 1;
      const b = Math.min(maxPayloadSize, preimage.length);

      const response = new Uint8Array(preimageLenVarint.length + 1 + b);
      let offset = 0;
      response.set(preimageLenVarint, offset);
      offset += preimageLenVarint.length;
      response[offset++] = b;
      response.set(preimage.slice(0, b), offset);

      if (b < preimage.length) {
        for (let i = b; i < preimage.length; i++) {
          context.queue.push(preimage.slice(i, i + 1));
        }
      }

      return response;
    } else {
      //temp error
      throw new Error("Preimage not found in dataStore");
    }
  }
}
