import { afterEach, expect, it, vi } from "vitest";
import { startGeolocation } from "../shared/geolocation";

afterEach(() => vi.useRealTimers());
function setup() {
  vi.useFakeTimers();
  const getCurrentPosition = vi.fn<Geolocation["getCurrentPosition"]>();
  const callbacks = { success: vi.fn(), error: vi.fn(), retry: vi.fn() };
  const cancel = startGeolocation({ getCurrentPosition }, callbacks);
  return { getCurrentPosition, callbacks, cancel };
}
const timeout = { code: 3 } as GeolocationPositionError;
const position = {
  coords: { latitude: 53.9, longitude: 27.56 },
} as GeolocationPosition;
it("retries a timed-out network fix with a fresh accurate fix and accepts its result", () => {
  const { getCurrentPosition: get, callbacks } = setup();
  get.mock.calls[0]![1]!(timeout);
  expect(get).toHaveBeenCalledTimes(2);
  expect(get.mock.calls[1]![2]).toEqual({
    enableHighAccuracy: true,
    timeout: 20000,
    maximumAge: 0,
  });
  expect(callbacks.error).not.toHaveBeenCalled();
  get.mock.calls[1]![0](position);
  expect(callbacks.success).toHaveBeenCalledWith(position);
  vi.advanceTimersByTime(40000);
  expect(callbacks.error).not.toHaveBeenCalled();
});
it("does not retry denied permission", () => {
  const { getCurrentPosition: get, callbacks } = setup();
  get.mock.calls[0]![1]!({ code: 1 } as GeolocationPositionError);
  expect(get).toHaveBeenCalledTimes(1);
  expect(callbacks.error).toHaveBeenCalledWith({ code: 1 });
});
it("ignores late coordinates and prevents retries after cancelling or choosing a map point", () => {
  const { getCurrentPosition: get, callbacks, cancel } = setup();
  cancel();
  get.mock.calls[0]![0](position);
  get.mock.calls[0]![1]!(timeout);
  vi.advanceTimersByTime(40000);
  expect(callbacks.success).not.toHaveBeenCalled();
  expect(callbacks.error).not.toHaveBeenCalled();
  expect(get).toHaveBeenCalledTimes(1);
});
it("ends a browser request that never calls back and rejects a later result", () => {
  const { getCurrentPosition: get, callbacks } = setup();
  vi.advanceTimersByTime(40000);
  expect(callbacks.error).toHaveBeenCalledWith({ code: 3 });
  get.mock.calls[0]![0](position);
  expect(callbacks.success).not.toHaveBeenCalled();
});
