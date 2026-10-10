<script setup lang="ts">
const { data: user, status } = await useAccount();
const cartSync = useCartSync();
const { reset } = useFavorites();
const open = ref(false);
const pending = ref(false);
const error = ref("");
const root = ref<HTMLElement>();
const trigger = ref<HTMLButtonElement>();
const route = useRoute();
function dismiss(event: PointerEvent) {
  if (!root.value?.contains(event.target as Node)) open.value = false;
}
function escape(event: KeyboardEvent) {
  if (event.key === "Escape" && open.value) {
    open.value = false;
    trigger.value?.focus();
  }
}
onMounted(() => {
  document.addEventListener("pointerdown", dismiss);
  document.addEventListener("keydown", escape);
});
onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", dismiss);
  document.removeEventListener("keydown", escape);
});
watch(
  () => route.path,
  () => {
    open.value = false;
  },
);
async function logout() {
  if (pending.value) return;
  pending.value = true;
  error.value = "";
  try {
    await $fetch("/api/auth/logout", { method: "POST", retry: 0 });
    cartSync.logout();
    reset();
    user.value = null;
    open.value = false;
    if (route.path === "/account") await navigateTo("/");
  } catch {
    error.value = "Не удалось выйти. Попробуйте ещё раз.";
  } finally {
    pending.value = false;
  }
}
</script>
<template>
  <div ref="root" class="account-menu">
    <span
      v-if="status === 'pending' && !user"
      class="account-placeholder"
      aria-label="Проверяем аккаунт"
      ><span class="spinner"
    /></span>
    <NuxtLink
      v-else-if="!user"
      to="/account"
      class="account-signin"
      aria-label="Аккаунт"
      >Войти</NuxtLink
    >
    <button
      v-else
      ref="trigger"
      class="account-authenticated"
      :aria-expanded="open"
      aria-controls="account-dropdown"
      aria-label="Меню аккаунта"
      @click="open = !open"
    >
      <AppIcon name="UserRound" :size="18" /><span
        class="account-dot"
      /><AppIcon name="ChevronDown" :size="13" />
    </button>
    <div v-if="open && user" id="account-dropdown" class="account-dropdown">
      <span class="account-caption">Вы вошли в Nabo</span
      ><strong>{{ user.phoneNumber }}</strong>
      <NuxtLink to="/saved">Сохранённое</NuxtLink>
      <button :disabled="pending" @click="logout">
        <AppIcon name="LogOut" :size="17" />{{ pending ? "Выходим…" : "Выйти" }}
      </button>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
    </div>
  </div>
</template>
<style scoped>
.account-menu {
  position: relative;
  flex-shrink: 0;
}
.account-signin,
.account-authenticated,
.account-placeholder {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 40px;
  padding: 8px 12px;
  border-radius: 22px;
  border: 1px solid var(--line);
  white-space: nowrap;
}
.account-signin {
  background: var(--brand);
  border-color: var(--brand);
  font-weight: 600;
}
.account-authenticated {
  background: var(--brand-soft);
  border-color: #d4e7ad;
}
.account-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #466923;
}
.account-placeholder .spinner {
  width: 18px;
  height: 18px;
  margin: 0;
}
.account-dropdown {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  width: 248px;
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 12px 36px #0f0f101a;
  z-index: 110;
  display: grid;
  gap: 8px;
}
.account-caption {
  font-size: 12px;
  color: var(--muted);
}
.account-dropdown strong {
  margin-bottom: 8px;
  font-size: 14px;
}
.account-dropdown a,
.account-dropdown button {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 10px;
  border-radius: 8px;
  text-align: left;
  font-size: 14px;
}
.account-dropdown a:hover,
.account-dropdown button:hover {
  background: var(--brand-soft);
}
</style>
