export function useAccount() {
  return useFetch<{ id: string; phoneNumber: string }>("/api/auth/me", {
    key: "account-session",
    retry: 0,
    lazy: true,
    timeout: 15000,
  });
}
