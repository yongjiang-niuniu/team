export const ACCESS_TOKEN_KEY = "access_token";
export const AUTH_USER_KEY = "auth_user";

export type AuthUser = {
  id: number;
  email: string;
  full_name?: string | null;
  auth_provider?: string | null;
  role: string;
  created_at?: string | null;
};

function readStorage(key: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(key);
}

export function getAccessToken(): string | null {
  return readStorage(ACCESS_TOKEN_KEY);
}

export function isDemoSocialToken(token: string | null): boolean {
  return Boolean(token?.startsWith("demo-social:"));
}

export function setAccessToken(token: string) {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function getStoredUser(): AuthUser | null {
  const raw = readStorage(AUTH_USER_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    window.localStorage.removeItem(AUTH_USER_KEY);
    return null;
  }
}

export function setStoredUser(user: AuthUser) {
  window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

export function clearAuthSession() {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(AUTH_USER_KEY);
}

export function isAuthenticated(): boolean {
  return Boolean(getAccessToken());
}

export function getDisplayName(user: AuthUser | null): string {
  if (user?.full_name?.trim()) {
    return user.full_name.trim();
  }

  if (!user?.email) {
    return "User";
  }

  const localPart = user.email.split("@")[0] ?? "user";
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getRoleLabel(role: string | undefined): string {
  switch ((role || "").toLowerCase()) {
    case "admin":
      return "Administrator";
    case "staff":
      return "Staff";
    default:
      return "Eco-Warrior (Owner)";
  }
}
