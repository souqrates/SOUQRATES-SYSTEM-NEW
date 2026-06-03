import { setInitDataGetter } from "@workspace/api-client-react";

function getInitData(): string {
  const tg = (window as unknown as {
    Telegram?: { WebApp?: { initData?: string } };
  }).Telegram?.WebApp;
  return tg?.initData || "";
}

function isApiRequest(input: RequestInfo | URL): boolean {
  let url = "";
  if (typeof input === "string") url = input;
  else if (input instanceof URL) url = input.toString();
  else if (input instanceof Request) url = input.url;
  if (!url) return false;
  if (url.startsWith("/")) return true;
  try {
    return new URL(url, window.location.origin).origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Wire Telegram initData into every API call:
 *  - generated react-query hooks via setInitDataGetter
 *  - raw fetch() calls via a same-origin fetch wrapper
 */
export function installApiAuth(): void {
  setInitDataGetter(getInitData);

  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
    const data = getInitData();
    if (data && isApiRequest(input) && !(input instanceof Request)) {
      const headers = new Headers(init.headers);
      if (!headers.has("x-telegram-init-data")) {
        headers.set("x-telegram-init-data", data);
      }
      return nativeFetch(input, { ...init, headers });
    }
    return nativeFetch(input, init);
  };
}
