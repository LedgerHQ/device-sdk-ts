import { HttpClient } from "../HttpClient";
import { CommandResponse } from "../model/CommandResponse";

export class SendService {
  private client: HttpClient;

  constructor(client: HttpClient) {
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
