import { getResolvedLocale } from "@/i18n";

/**
 * Drop-in replacement for `fetch` that automatically injects locale header.
 */
export async function request(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(input, {
    ...init,
    headers: {
      ...init.headers,
      "x-app-locale": getResolvedLocale(),
    },
  });
}
