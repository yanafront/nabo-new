// A bounded, per-application cache. Aborting one consumer never cancels another.
export function createRequestCache(limit = 80, now = Date.now) {
  const values = new Map<string, { value: unknown; until: number }>();
  const pending = new Map<string, Promise<unknown>>();
  return async function request<T>(key: string, load: () => Promise<T>, ttl: number,
    signal?: AbortSignal, cacheable: (value: T) => boolean = () => true): Promise<T> {
    signal?.throwIfAborted();
    const cached = values.get(key);
    if (cached && cached.until > now()) return structuredClone(cached.value) as T;
    values.delete(key);
    let promise = pending.get(key) as Promise<T> | undefined;
    if (!promise) {
      promise = load().then(value => {
        if (cacheable(value)) {
          values.set(key, { value: structuredClone(value), until: now() + ttl });
          while (values.size > limit) values.delete(values.keys().next().value!);
        }
        return value;
      }).finally(() => pending.delete(key));
      pending.set(key, promise);
    }
    return new Promise<T>((resolve, reject) => {
      const abort = () => reject(signal?.reason || new DOMException("Aborted", "AbortError"));
      signal?.addEventListener("abort", abort, { once: true });
      promise!.then(value => { if (!signal?.aborted) resolve(structuredClone(value)); }, reject)
        .finally(() => signal?.removeEventListener("abort", abort));
    });
  };
}
