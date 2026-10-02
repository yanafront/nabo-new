type GeolocationFailure = { code: number; message?: string };
// Native requests cannot be aborted. Ignore late callbacks after cancellation,
// and bound the wait even if the browser never invokes its error callback.
export function startGeolocation(
  geolocation: Pick<Geolocation, "getCurrentPosition">,
  callbacks: {
    success(position: GeolocationPosition): void;
    error(failure: GeolocationFailure): void;
    retry(): void;
  },
): () => void {
  let active = true;
  const cancel = () => {
    active = false;
    clearTimeout(deadline);
  };
  const fail = (failure: GeolocationFailure) => {
    if (!active) return;
    cancel();
    callbacks.error(failure);
  };
  const deadline = setTimeout(() => fail({ code: 3 }), 40000);
  function request(precise: boolean) {
    geolocation.getCurrentPosition(
      (position) => {
        if (!active) return;
        cancel();
        callbacks.success(position);
      },
      (failure) => {
        if (!active) return;
        if (!precise && (failure.code === 2 || failure.code === 3)) {
          callbacks.retry();
          if (active) request(true);
        } else fail(failure);
      },
      precise
        ? { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
        : { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    );
  }
  request(false);
  return cancel;
}
