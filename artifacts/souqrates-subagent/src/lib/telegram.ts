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
