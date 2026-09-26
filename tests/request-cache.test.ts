import { describe, it, expect, vi } from 'vitest';
import { createRequestCache } from '../utils/request-cache';
describe('bounded request cache', () => {
  it('reuses results, expires them and isolates mutable consumers', async () => {
    let now = 0;
    const request = createRequestCache(2, () => now);
    const load = vi.fn(async () => ({ price: 5 }));
    const first = await request('milk', load, 30);
    first.price = 99;
    expect((await request('milk', load, 30)).price).toBe(5);
    expect(load).toHaveBeenCalledTimes(1);
    now = 31; await request('milk', load, 30);
    expect(load).toHaveBeenCalledTimes(2);
  });
  it('joins overlapping requests without one cancelled subscriber cancelling another', async () => {
    const request = createRequestCache();
    let complete!: (value: number) => void;
    const load = vi.fn(() => new Promise<number>(resolve => { complete = resolve; }));
    const controller = new AbortController();
    const first = request('same', load, 1000, controller.signal);
    const second = request('same', load, 1000);
    const rejected = expect(first).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort(); complete(42);
    await rejected; expect(await second).toBe(42);
    expect(load).toHaveBeenCalledTimes(1);
  });
  it('does not cache network failures or provider error responses', async () => {
    const request = createRequestCache();
    const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ status: 'error' });
    const valid = (v: { status: string }) => v.status === 'ok';
    await expect(request('x', load, 1000)).rejects.toThrow('offline');
    await request('x', load, 1000, undefined, valid);
    await request('x', load, 1000, undefined, valid);
    expect(load).toHaveBeenCalledTimes(3);
  });
  it('bounds memory and separates query, store and coordinates', async () => {
    const request = createRequestCache(2);
    const load = vi.fn(async () => 1);
    for (const key of ['green:milk:53.9', 'santa:milk:53.9', 'green:milk:54', 'green:milk:53.9'])
      await request(key, load, 1000);
    expect(load).toHaveBeenCalledTimes(4);
  });
  it('never starts a request for an already cancelled consumer', async () => {
    const request = createRequestCache(); const load = vi.fn(async () => 1);
    const controller = new AbortController(); controller.abort();
    await expect(request('x', load, 1000, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(load).not.toHaveBeenCalled();
  });
});
