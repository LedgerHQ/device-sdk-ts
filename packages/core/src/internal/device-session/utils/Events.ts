export class EventBus<E extends CustomEvent> extends EventTarget {
  constructor() {
    super();
  }

  addCustomEventListener<T extends E>(
    type: T["type"],
    listener: (event: T) => void,
    options?: boolean | AddEventListenerOptions,
  ) {
    const eventListener: EventListener = (event: Event) => {
      listener(event as T);
    };
    this.addEventListener(type, eventListener, options);
  }

  dispatchCustomEvent<T>(type: string, detail: T) {
    const event = new CustomEvent<T>(type, { detail });
    this.dispatchEvent(event);
  }
}
