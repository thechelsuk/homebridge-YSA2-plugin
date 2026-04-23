// Simple async lock utility (optional, can be omitted if not needed)
export class Lock {
  private _locked = false;
  private _waiting: Array<() => void> = [];

  async acquire(): Promise<void> {
    if (!this._locked) {
      this._locked = true;
      return;
    }
    return new Promise(resolve => this._waiting.push(resolve));
  }

  release(): void {
    if (this._waiting.length > 0) {
      const next = this._waiting.shift();
      if (next) next();
    } else {
      this._locked = false;
    }
  }
}
