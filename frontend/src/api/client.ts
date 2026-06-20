const TOKEN_KEY = 'mostajir_token';

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function url(path: string): string {
  return `${API_BASE}${path}`;
}

function headers(extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json', ...extra };
  const token = getToken();
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

export class UnauthorizedError extends Error {
  constructor() { super('Unauthorized'); this.name = 'UnauthorizedError'; }
}

async function handleResponse<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (res.status === 401) {
    throw new UnauthorizedError();
  }
  if (!res.ok) throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
  return body as T;
}

export const api = {
  get<T>(path: string): Promise<T> {
    return fetch(url(path), { headers: headers() }).then(r => handleResponse<T>(r));
  },
  post<T>(path: string, body?: unknown): Promise<T> {
    return fetch(url(path), {
      method: 'POST', headers: headers(), body: JSON.stringify(body),
    }).then(r => handleResponse<T>(r));
  },
  put<T>(path: string, body?: unknown): Promise<T> {
    return fetch(url(path), {
      method: 'PUT', headers: headers(), body: JSON.stringify(body),
    }).then(r => handleResponse<T>(r));
  },
  delete<T>(path: string): Promise<T> {
    return fetch(url(path), {
      method: 'DELETE', headers: headers(),
    }).then(r => handleResponse<T>(r));
  },
  async upload<T>(path: string, formData: FormData): Promise<T> {
    const token = getToken();
    const h: Record<string, string> = {};
    if (token) h['Authorization'] = `Bearer ${token}`;
    const res = await fetch(url(path), { method: 'POST', headers: h, body: formData });
    return handleResponse<T>(res);
  },
};
