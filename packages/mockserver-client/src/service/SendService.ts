import { type DefaultHttpClient } from "../DefaultHttpClient";
import { type HttpClient } from "../HttpClient";
import { type CommandResponse } from "../model/CommandResponse";

export class SendService {
  private client: HttpClient;

  constructor(client: DefaultHttpClient) {
    this.client = client;
  }

  async send(sessionId: string, command: string): Promise<CommandResponse> {
    return this.client.post<CommandResponse>(
      "send",
      { command: command },
      { session_id: sessionId },
    );
  }
}
