import type {
  App,
  AppBrief,
  AppEvaluation,
  AppWrite,
  EnergySnapshot,
  Job,
  JobStatus,
  JobWrite,
  Page,
  Policy,
  PolicyWrite,
  Rule,
  RuleCatalog,
  RuleWrite,
  User,
} from './types';
import { getToken, setSession } from './auth';

// Same-origin: nginx (Docker) or the Vite dev proxy forwards /api to Django.
const BASE = '/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`HTTP ${status}`);
  }
}

type Params = Record<string, string | number | boolean | null | undefined>;

function query(params: Params = {}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

async function request<T>(method: string, path: string, body?: unknown, auth = true): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = auth ? getToken() : null;
  if (token) headers.Authorization = `Token ${token}`;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'omit',
  });
  // Missing / revoked token: drop the session so the app shows the login form.
  if (res.status === 401 && auth) setSession(null);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}

const get = <T>(path: string) => request<T>('GET', path);
const post = <T>(path: string, body?: unknown) => request<T>('POST', path, body);
const patch = <T>(path: string, body: unknown) => request<T>('PATCH', path, body);
const del = (path: string) => request<void>('DELETE', path);

/** Walks every page (100 per request); for small lookup lists like selects. */
async function fetchAll<T>(path: string, params: Params = {}): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; ; page++) {
    const res = await get<Page<T>>(path + query({ ...params, page, page_size: 100 }));
    items.push(...res.results);
    if (!res.next) return items;
  }
}

export interface ListParams extends Params {
  page?: number;
  page_size?: number;
}

export const api = {
  auth: {
    /** Exchanges a Django user's credentials for the API token (sent without a token). */
    obtainToken: (username: string, password: string) =>
      request<{ token: string }>('POST', '/auth/token/', { username, password }, false),
    /** Open sign-up; always creates role `user` (read-only). Does not log in. */
    register: (username: string, password: string) =>
      request<User>('POST', '/auth/register/', { username, password }, false),
    /** Deletes the caller's token server-side, ending every session of that user. */
    logout: () => post<void>('/auth/logout/'),
  },
  apps: {
    list: (p: ListParams & { search?: string }) => get<Page<App>>(`/apps/${query(p)}`),
    all: () => fetchAll<App>('/apps/'),
    create: (body: AppWrite) => post<App>('/apps/', body),
    update: (id: number, body: Partial<AppWrite>) => patch<App>(`/apps/${id}/`, body),
    remove: (id: number) => del(`/apps/${id}/`),
    evaluate: (id: number) => get<AppEvaluation>(`/apps/${id}/evaluate/`),
  },
  rules: {
    list: (p: ListParams & { search?: string; is_active?: string }) => get<Page<Rule>>(`/rules/${query(p)}`),
    all: () => fetchAll<Rule>('/rules/'),
    catalog: () => get<RuleCatalog>('/rules/catalog/'),
    create: (body: RuleWrite) => post<Rule>('/rules/', body),
    update: (id: number, body: Partial<RuleWrite>) => patch<Rule>(`/rules/${id}/`, body),
    remove: (id: number) => del(`/rules/${id}/`),
    unlink: (id: number) => post<void>(`/rules/${id}/unlink/`),
  },
  policies: {
    list: (p: ListParams & { search?: string; is_active?: string }) => get<Page<Policy>>(`/policies/${query(p)}`),
    all: () => fetchAll<Policy>('/policies/'),
    create: (body: PolicyWrite) => post<Policy>('/policies/', body),
    update: (id: number, body: Partial<PolicyWrite>) => patch<Policy>(`/policies/${id}/`, body),
    remove: (id: number) => del(`/policies/${id}/`),
    apps: (id: number) => get<AppBrief[]>(`/policies/${id}/apps/`),
  },
  jobs: {
    list: (p: ListParams & { status?: JobStatus | '' }) => get<Page<Job>>(`/jobs/${query(p)}`),
    create: (body: JobWrite) => post<Job>('/jobs/', body),
    update: (id: number, body: Partial<JobWrite>) => patch<Job>(`/jobs/${id}/`, body),
    remove: (id: number) => del(`/jobs/${id}/`),
  },
  energy: {
    snapshots: (p: ListParams & { from?: string; to?: string }) => get<Page<EnergySnapshot>>(`/energy/snapshots/${query(p)}`),
    current: () => get<EnergySnapshot>('/energy/current/'),
  },
};

/** Human-readable text for any thrown error, including DRF validation trees. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const body = err.body;
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      if ('detail' in body) return String((body as { detail: unknown }).detail);
      return flatten(body).join('\n');
    }
    if (err.status === 401) return 'Not authorized: log in again.';
    if (err.status >= 502 && err.status <= 504) return 'Backend unreachable: is the Django server running?';
    return `Request failed: HTTP ${err.status}`;
  }
  if (err instanceof TypeError) return 'Network error: cannot reach the server.';
  if (err instanceof Error) return err.message;
  return String(err);
}

function flatten(value: unknown, path = ''): string[] {
  if (Array.isArray(value)) {
    if (value.every((v) => typeof v === 'string')) return value.map((m) => (path ? `${path}: ${m}` : m));
    return value.flatMap((v, i) => flatten(v, `${path}[${i}]`));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, v]) => {
      if (key === 'non_field_errors') return flatten(v, path);
      const next = /^\d+$/.test(key) ? `${path}[${key}]` : path ? `${path}.${key}` : key;
      return flatten(v, next);
    });
  }
  return [path ? `${path}: ${String(value)}` : String(value)];
}

/** The HTTP status of a failed request, if it came from the API. */
export const statusOf = (err: unknown) => (err instanceof ApiError ? err.status : undefined);
