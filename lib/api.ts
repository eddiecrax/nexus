/**
 * Minimal API client for talking to the Express backend.
 *
 * Concept (Client-Server & HttpOnly Cookies):
 * Next.js runs on :3000 and Express runs on :4000. Setting `credentials: "include"`
 * tells the browser to send and store the HttpOnly `nexus_token` JWT cookie
 * across those two origins (paired with `cors({ credentials: true })` on Express).
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // Express returns `{ error: { code, message } }` consistently on failures.
    const message = data?.error?.message || `Request failed (${res.status})`;
    throw new Error(message);
  }

  return data as T;
}

