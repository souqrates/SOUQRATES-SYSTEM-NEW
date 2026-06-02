declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            photo_url?: string;
          };
          start_param?: string;
        };
        ready(): void;
        expand(): void;
      };
    };
  }
}

export function initTelegram(): void {
  const tg = window.Telegram?.WebApp;
  if (tg) { tg.ready(); tg.expand(); }
}

export function getTelegramId(): string {
  const user = window.Telegram?.WebApp?.initDataUnsafe?.user;
  if (user) return user.id.toString();
  return localStorage.getItem("tg_id_override") ?? "demo_user_001";
}

export function getTelegramUser() {
  const user = window.Telegram?.WebApp?.initDataUnsafe?.user;
  if (user) {
    return {
      telegramId: user.id.toString(),
      firstName: user.first_name,
      lastName: user.last_name,
      username: user.username,
      photoUrl: user.photo_url,
    };
  }
  return { telegramId: "demo_user_001", firstName: "Demo", username: "souqrates_demo" };
}
