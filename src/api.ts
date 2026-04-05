// Precedence: localStorage override → env var baked at build time → default
declare const __WREN_API_URL__: string | undefined;
const ENV_API_URL = typeof __WREN_API_URL__ !== "undefined" ? __WREN_API_URL__ : undefined;

export function getApiUrl(): string {
  if (typeof localStorage !== "undefined") {
    return localStorage.getItem("wren_url") ?? ENV_API_URL ?? "http://localhost:4000";
  }
  return ENV_API_URL ?? "http://localhost:4000";
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

export interface CollectionInfo {
  name: string;
  count: number;
  updatedAt: string;
}

export async function listCollections(): Promise<CollectionInfo[]> {
  const res = await req<{ collections: CollectionInfo[] }>("/collections");
  return res.collections;
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

export async function listDocumentPaths(
  collection: string,
  id: string
): Promise<{ id: string; collection: string; paths: { tree: string; path: string }[] }> {
  return req(`/${collection}/${id}/paths`);
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
  label: string,
  version?: number
): Promise<void> {
  await req<void>(`/${collection}/${id}/labels`, {
    method: "POST",
    body: JSON.stringify(version !== undefined ? { label, version } : { label }),
  });
}

export async function getCollectionSchema(
  collection: string
): Promise<{ collection: string; collectionType: "json" | "binary"; schema: unknown; displayName: string | null; updatedAt: string } | null> {
  try {
    return await req(`/${collection}/_schema`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export async function setCollectionSchema(
  collection: string,
  schema: unknown,
  displayName?: string | null,
  collectionType?: "json" | "binary"
): Promise<void> {
  const payload: Record<string, unknown> = { schema, displayName: displayName ?? null };
  if (collectionType !== undefined) payload.collectionType = collectionType;
  await req(`/${collection}/_schema`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

// --- Binary assets ---

export async function createAsset(collection: string, file: File): Promise<Document> {
  const base = getApiUrl();
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${base}/${collection}`, {
    method: "POST",
    credentials: "include",
    headers: { "Accept": "application/json", "Origin": base },
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new ApiError(res.status, body.error ?? res.statusText);
  }
  return res.json() as Promise<Document>;
}

export async function updateAsset(collection: string, id: string, file: File): Promise<Document> {
  const base = getApiUrl();
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${base}/${collection}/${id}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Accept": "application/json", "Origin": base },
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new ApiError(res.status, body.error ?? res.statusText);
  }
  return res.json() as Promise<Document>;
}

export function getAssetRawUrl(collection: string, id: string, version?: number): string {
  const base = getApiUrl();
  const qs = version !== undefined ? `?version=${version}` : "";
  return `${base}/${collection}/${id}/raw${qs}`;
}

export async function deleteCollectionSchema(collection: string): Promise<void> {
  await req(`/${collection}/_schema`, { method: "DELETE" });
}

export interface TreeInfo {
  name: string;
  count: number;
}

export interface TreeChild {
  path: string;
  documentId: string;
}

export interface TreeNode {
  path: string;
  document: Document | null;
  assignmentDocId: string | null;
  children: TreeChild[];
}

export async function listTrees(): Promise<TreeInfo[]> {
  const res = await req<{ trees: TreeInfo[] }>("/tree");
  return res.trees;
}

export async function getTreeNode(treeName: string, path: string): Promise<TreeNode> {
  return req<TreeNode>(`/tree/${treeName}${path}`);
}

export async function setTreePath(treeName: string, path: string, documentId: string): Promise<void> {
  await req<void>(`/tree/${treeName}${path}`, {
    method: "PUT",
    body: JSON.stringify({ documentId }),
  });
}

export async function deleteTreePath(treeName: string, path: string): Promise<void> {
  await req<void>(`/tree/${treeName}${path}`, { method: "DELETE" });
}

export interface FullTreeNode {
  path: string;
  documentId: string;
  document: {
    id: string;
    collection: string;
    version: number;
    data: Record<string, unknown>;
  };
}

export async function listFullTree(treeName: string): Promise<FullTreeNode[]> {
  const res = await req<{ tree: string; nodes: FullTreeNode[] }>(`/tree/${treeName}?full=true`);
  return res.nodes;
}

export async function getVersionData(
  collection: string,
  id: string,
  version: number
): Promise<Document> {
  return req<Document>(`/${collection}/${id}/versions/${version}`);
}

// --- API Keys ---

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface ApiKeyCreated extends ApiKey {
  key: string; // full key, returned once only
}

export async function listApiKeys(): Promise<ApiKey[]> {
  const res = await req<{ keys: ApiKey[] }>("/api/keys");
  return res.keys;
}

export async function createApiKey(name: string): Promise<ApiKeyCreated> {
  return req<ApiKeyCreated>("/api/keys", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function revokeApiKey(id: string): Promise<void> {
  await req<void>(`/api/keys/${id}`, { method: "DELETE" });
}

// --- Org context ---

export interface OrgInfo {
  id: string;
  name: string;
  email?: string;
  own: boolean;
}

export interface OrgContext {
  current: string;
  orgs: OrgInfo[];
}

export async function getOrgContext(): Promise<OrgContext> {
  return req<OrgContext>("/api/org");
}

export async function switchOrg(orgId: string): Promise<void> {
  await req<{ current: string }>("/api/org", {
    method: "PUT",
    body: JSON.stringify({ orgId }),
  });
}

// --- Invites ---

export interface Invite {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
}

export interface InviteCreated extends Invite {
  token: string; // raw token, returned once only
}

export async function listInvites(): Promise<Invite[]> {
  const res = await req<{ invites: Invite[] }>("/api/invites");
  return res.invites;
}

export async function createInvite(email: string, role = "member"): Promise<InviteCreated> {
  return req<InviteCreated>("/api/invites", {
    method: "POST",
    body: JSON.stringify({ email, role }),
  });
}

export async function revokeInvite(id: string): Promise<void> {
  await req<void>(`/api/invites/${id}`, { method: "DELETE" });
}

export async function acceptInvite(token: string): Promise<{ accepted: boolean; orgId: string }> {
  return req<{ accepted: boolean; orgId: string }>("/api/invites/accept", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

// --- Members ---

export interface Member {
  userId: string;
  name: string;
  email: string;
  role: string;
  joinedAt: string;
}

export async function listMembers(): Promise<Member[]> {
  const res = await req<{ members: Member[] }>("/api/members");
  return res.members;
}

export async function removeMember(userId: string): Promise<void> {
  await req<void>(`/api/members/${userId}`, { method: "DELETE" });
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
