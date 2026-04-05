export function getApiUrl(): string {
  if (typeof localStorage !== "undefined") {
    return localStorage.getItem("wren_url") ?? "http://localhost:4000";
  }
  return "http://localhost:4000";
}

async function req<T>(path: string, options: RequestInit = {}): Promise<T> {
  const base = getApiUrl();
  const res = await fetch(`${base}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Origin": base,
      ...(options.headers as Record<string, string> ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new ApiError(res.status, body.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface User {
  id: string;
  email: string;
  name: string;
  role?: string;
  orgId?: string | null;
}

export interface Document {
  id: string;
  version: number;
  collection: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentList {
  collection: string;
  items: Document[];
  total: number;
}

export interface VersionMeta {
  version: number;
  createdAt: string;
  createdBy: string;
}

export interface DiffEntry {
  op: "add" | "remove" | "replace";
  path: string;
  value?: unknown;
  oldValue?: unknown;
}

export interface DiffResult {
  id: string;
  collection: string;
  v1: number;
  v2: number;
  diff: DiffEntry[];
}

export async function getSession(): Promise<{ user: User } | null> {
  try {
    return await req<{ user: User }>("/api/auth/get-session");
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null;
    throw e;
  }
}

export async function signIn(email: string, password: string): Promise<User> {
  return req<User>("/api/auth/sign-in/email", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function signOut(): Promise<void> {
  await req<void>("/api/auth/sign-out", { method: "POST" });
}

export async function listDocuments(
  collection: string,
  options?: { limit?: number; offset?: number }
): Promise<DocumentList> {
  const params = new URLSearchParams();
  if (options?.limit !== undefined) params.set("limit", String(options.limit));
  if (options?.offset !== undefined) params.set("offset", String(options.offset));
  const qs = params.toString() ? `?${params.toString()}` : "";
  return req<DocumentList>(`/${collection}${qs}`);
}

export async function getDocument(
  collection: string,
  id: string,
  label?: string
): Promise<Document> {
  const qs = label ? `?label=${encodeURIComponent(label)}` : "";
  return req<Document>(`/${collection}/${id}${qs}`);
}

export async function createDocument(
  collection: string,
  data: Record<string, unknown>
): Promise<Document> {
  return req<Document>(`/${collection}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateDocument(
  collection: string,
  id: string,
  data: Record<string, unknown>
): Promise<Document> {
  return req<Document>(`/${collection}/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteDocument(collection: string, id: string): Promise<void> {
  await req<void>(`/${collection}/${id}`, { method: "DELETE" });
}

export async function listVersions(
  collection: string,
  id: string
): Promise<{ id: string; collection: string; versions: VersionMeta[] }> {
  return req(`/${collection}/${id}/versions`);
}

export async function setLabel(
  collection: string,
  id: string,
  label: string
): Promise<void> {
  await req<void>(`/${collection}/${id}/labels`, {
    method: "POST",
    body: JSON.stringify({ label }),
  });
}

export async function diffVersions(
  collection: string,
  id: string,
  v1: number,
  v2: number
): Promise<DiffResult> {
  return req<DiffResult>(
    `/${collection}/${id}/diff?v1=${v1}&v2=${v2}`
  );
}
