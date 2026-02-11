import { useRozeniteDevToolsClient as a } from "@rozenite/plugin-bridge";
import { useState as c, useEffect as l } from "react";
import { ReplaySubject as u, Subject as m } from "rxjs";
const t = class t {
  constructor() {
    this.rozeniteClient = null, this.messagesToSend = new u(), this.messagesFromDashboard = new m(), this.messagesToSendSubscription = null;
  }
  static getInstance() {
    return t.instance || (t.instance = new t()), t.instance;
  }
  static destroyInstance() {
    t.instance && (t.instance.destroy(), t.instance = null);
  }
  setClient(s) {
    this.messagesToSendSubscription && (this.messagesToSendSubscription.unsubscribe(), this.messagesToSendSubscription = null), this.rozeniteClient && this.rozeniteClient.close(), this.rozeniteClient = s, this.initialize().catch((e) => {
      console.error("[RozeniteConnector] Error initializing", e);
    });
  }
  destroy() {
    this.messagesToSendSubscription && (this.messagesToSendSubscription.unsubscribe(), this.messagesToSendSubscription = null), this.rozeniteClient?.close(), this.messagesToSend.complete(), this.messagesFromDashboard.complete();
  }
  async initialize() {
    const s = this.rozeniteClient;
    if (!s)
      throw new Error("[RozeniteConnector] Client not set");
    this.messagesToSendSubscription && (this.messagesToSendSubscription.unsubscribe(), this.messagesToSendSubscription = null);
    const e = () => {
      this.messagesToSendSubscription && this.messagesToSendSubscription.unsubscribe(), this.messagesToSendSubscription = this.messagesToSend.subscribe({
        next: (n) => {
          s.send("message", n);
        }
      });
    };
    s.onMessage("init", () => {
      const n = !!this.messagesToSendSubscription;
      e(), n || s.send("init", "init response");
    }), s.onMessage("message", ({ type: n, payload: r }) => {
      this.messagesFromDashboard.next({ type: n, payload: r });
    }), s.send("init", "init message from client");
  }
  sendMessage(s, e) {
    this.messagesToSend.next({ type: s, payload: e });
  }
  listenToMessages(s) {
    return this.messagesFromDashboard.subscribe({
      next: (e) => s(e.type, e.payload)
    });
  }
};
t.instance = null;
let o = t;
const h = "@ledgerhq/device-management-kit-devtools-rozenite", d = h;
function p() {
  const i = a({ pluginId: d }), [s, e] = c(null);
  return l(() => {
    if (i) {
      const n = o.getInstance();
      n.setClient(i), e(n);
    }
  }, [i]), s;
}
export {
  o as RozeniteConnector,
  p as useRozeniteConnector
};
