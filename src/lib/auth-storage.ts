export type SessionUser = {
  accessToken: string;
  username: string;
  roles: string[];
  expiresInMs: number;
  tokenType: string;
};

const AUTH_STORAGE_KEY = "erm_session_user";

export function loadSession(): SessionUser | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const session = JSON.parse(raw) as SessionUser;
    // expiresInMs now stores absolute expiry timestamp (ms since epoch). If expired, clear and return null.
    if (typeof session.expiresInMs === "number" && Date.now() > session.expiresInMs) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
    return session;
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export function saveSession(session: SessionUser) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}
