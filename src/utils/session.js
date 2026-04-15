export const SESSION_USER_ID_KEY = 'gsmUserId';
export const SESSION_USERNAME_KEY = 'gsmUsername';

const ADMIN_USERNAMES = new Set(['admin', 'mscadmin', 'msc admin', 'administrator']);

export function getStoredUserId() {
  const rawValue = localStorage.getItem(SESSION_USER_ID_KEY);
  if (!rawValue) return null;

  const parsedValue = Number.parseInt(rawValue, 10);
  return Number.isNaN(parsedValue) ? null : parsedValue;
}

export function storeSessionUser(user) {
  localStorage.setItem(SESSION_USER_ID_KEY, String(user.id));

  if (user.username) {
    localStorage.setItem(SESSION_USERNAME_KEY, user.username);
  }
}

export function clearSessionUser() {
  localStorage.removeItem(SESSION_USER_ID_KEY);
  localStorage.removeItem(SESSION_USERNAME_KEY);
}

export function isAdminUser(user) {
  if (!user?.username) return false;
  return ADMIN_USERNAMES.has(user.username.trim().toLowerCase());
}
