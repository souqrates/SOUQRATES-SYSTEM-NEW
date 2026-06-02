const TELEGRAM_ID_KEY = "skillz_telegram_id";
const DEFAULT_ID = "demo_user_001";

export function getTelegramId(): string {
  if (typeof window === "undefined") return DEFAULT_ID;
  const stored = localStorage.getItem(TELEGRAM_ID_KEY);
  if (stored) return stored;
  localStorage.setItem(TELEGRAM_ID_KEY, DEFAULT_ID);
  return DEFAULT_ID;
}

export function setTelegramId(id: string) {
  localStorage.setItem(TELEGRAM_ID_KEY, id);
}
