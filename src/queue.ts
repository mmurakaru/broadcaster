export class AsyncQueue<T> {
  private items: T[] = [];
  private waiters: Array<{ resolve: (v: T | null) => void; timer: NodeJS.Timeout | null }> = [];
  private closed = false;

  put(item: T): void {
    if (this.closed) return;
    const w = this.waiters.shift();
    if (w) {
      if (w.timer) clearTimeout(w.timer);
      w.resolve(item);
      return;
    }
    this.items.push(item);
  }

  get(timeoutMs: number): Promise<T | null> {
    if (this.items.length > 0) {
      return Promise.resolve(this.items.shift()!);
    }
    if (this.closed) return Promise.resolve(null);

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        const idx = this.waiters.findIndex((w) => w.resolve === resolve);
        if (idx >= 0) this.waiters.splice(idx, 1);
        resolve(null);
      }, timeoutMs);
      this.waiters.push({ resolve, timer });
    });
  }

  close(): void {
    this.closed = true;
    for (const w of this.waiters) {
      if (w.timer) clearTimeout(w.timer);
      w.resolve(null);
    }
    this.waiters = [];
  }
}
