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
            language_code?: string;
          };
          start_param?: string;
        };
        ready(): void;
        expand(): void;
        close(): void;
        colorScheme: "light" | "dark";
      };
    };
  }
}

export type TelegramUser = {
  telegramId: string;
  firstName: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
};

export function initTelegram(): void {
  const tg = window.Telegram?.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
  }
}

export function getTelegramUser(): TelegramUser {
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
  return {
    telegramId: localStorage.getItem("tg_id_override") ?? "demo_user_001",
    firstName: "Demo",
    username: "souqrates_demo",
  };
}

export function getReferralParam(): string | undefined {
  return window.Telegram?.WebApp?.initDataUnsafe?.start_param || undefined;
}

export function isInsideTelegram(): boolean {
  return !!window.Telegram?.WebApp?.initDataUnsafe?.user;
}
