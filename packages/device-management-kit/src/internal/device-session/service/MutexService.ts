export class MutexService {
  private _queue: Array<() => void> = [];
  private _locked = false;

  async lock(): Promise<() => void> {
    return new Promise((resolve) => {
      const release = () => {
        this._locked = false;
        if (this._queue.length > 0) {
          const next = this._queue.shift();
          this._locked = true;
          next!();
        }
      };

      if (!this._locked) {
        this._locked = true;
        resolve(release);
      } else {
        this._queue.push(() => resolve(release));
      }
    });
  }

  clear() {
    this._queue = [];
    this._locked = false;
  }
}
