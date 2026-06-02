export function getTelegramId() {
  return localStorage.getItem("souqrates_telegram_id") || "demo_user_001";
}
