const TOKEN_KEY = 'mostajir_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function headers(extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json', ...extra };
  const token = getToken();
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

async function handleResponse<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (res.status === 401) {
    clearToken();
    throw new Error('Unauthorized');
  }
  if (!res.ok) throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
  return body as T;
}

export const api = {
  get<T>(path: string): Promise<T> {
    return fetch(path, { headers: headers() }).then(r => handleResponse<T>(r));
  },
  post<T>(path: string, body?: unknown): Promise<T> {
    return fetch(path, {
      method: 'POST', headers: headers(), body: JSON.stringify(body),
    }).then(r => handleResponse<T>(r));
  },
  put<T>(path: string, body?: unknown): Promise<T> {
    return fetch(path, {
      method: 'PUT', headers: headers(), body: JSON.stringify(body),
    }).then(r => handleResponse<T>(r));
  },
  delete<T>(path: string): Promise<T> {
    return fetch(path, {
      method: 'DELETE', headers: headers(),
    }).then(r => handleResponse<T>(r));
  },
  async upload<T>(path: string, formData: FormData): Promise<T> {
    const token = getToken();
    const h: Record<string, string> = {};
    if (token) h['Authorization'] = `Bearer ${token}`;
    const res = await fetch(path, { method: 'POST', headers: h, body: formData });
    return handleResponse<T>(res);
  },
};
