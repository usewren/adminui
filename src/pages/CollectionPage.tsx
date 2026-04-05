import React, { useEffect, useRef, useState } from "react";
import { Button, Table, Spinner, EmptyState, Card, Tabs } from "componentlibrary";
import { ConfirmButton } from "../ConfirmButton";
import {
  listDocuments,
  createDocument,
  getCollectionSchema,
  setCollectionSchema,
  deleteCollectionSchema,
  createAsset,
  getAssetRawUrl,
  type Document,
  type User,
} from "../api";


interface CollectionPageProps {
  collection: string | null;
  tab?: "documents" | "schema";
  user: User;
}

const PAGE_SIZE = 20;

export function applyDisplayRule(rule: string, data: Record<string, unknown>): string {
  return rule.replace(/\{(\w+)\}/g, (_, key: string) => {
    const val = data[key];
    return val !== undefined && val !== null ? String(val) : `{${key}}`;
  });
}

function docPreview(data: Record<string, unknown>, displayRule: string): string {
  if (displayRule) return applyDisplayRule(displayRule, data);
  const firstKey = Object.keys(data)[0];
  return firstKey ? `${firstKey}: ${JSON.stringify(data[firstKey])}` : "(empty)";
}

export function CollectionPage({ collection, tab: tabProp, user: _user }: CollectionPageProps) {
  const activeTab = tabProp ?? "documents";

  function setTab(t: "documents" | "schema") {
    if (!collection) return;
    const hash = t === "schema"
      ? `#/collections/${collection}?tab=schema`
      : `#/collections/${collection}`;
    window.location.hash = hash;
  }

  // Documents tab state
  const [documents, setDocuments] = useState<Document[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newJson, setNewJson] = useState("{\n  \n}");
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [collectionType, setCollectionType] = useState<"json" | "binary">("json");
  const [displayName, setDisplayName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Schema tab state
  const [schemaJson, setSchemaJson] = useState("");
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [schemaSaving, setSchemaSaving] = useState(false);
  const [schemaDeleting, setSchemaDeleting] = useState(false);
  const [hasSchema, setHasSchema] = useState(false);
  const [schemaCollectionType, setSchemaCollectionType] = useState<"json" | "binary">("json");

  useEffect(() => {
    setOffset(0);
  }, [collection]);

  useEffect(() => {
    if (!collection) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    // Load documents and display rule in parallel
    Promise.all([
      listDocuments(collection, { limit: PAGE_SIZE, offset }),
      getCollectionSchema(collection),
    ])
      .then(([result, schemaResult]) => {
        if (cancelled) return;
        setDocuments(result.items);
        setTotal(result.total);
        if (schemaResult?.displayName) setDisplayName(schemaResult.displayName);
        if (schemaResult?.collectionType) setCollectionType(schemaResult.collectionType);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load documents");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [collection, offset]);

  useEffect(() => {
    if (!collection || activeTab !== "schema") return;
    setSchemaLoading(true);
    setSchemaError(null);
    getCollectionSchema(collection)
      .then(async (result) => {
        if (result) {
          setSchemaJson(result.schema ? JSON.stringify(result.schema, null, 2) : "");
          setDisplayName(result.displayName ?? "");
          setSchemaCollectionType(result.collectionType ?? "json");
          setHasSchema(true);
        } else {
          setSchemaJson("{\n  \"type\": \"object\",\n  \"additionalProperties\": true\n}");
          setDisplayName("");
          setSchemaCollectionType("json");
          setHasSchema(false);
        }
      })
      .catch((err) => setSchemaError(err instanceof Error ? err.message : "Failed to load schema"))
      .finally(() => setSchemaLoading(false));
  }, [collection, activeTab]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!collection) return;
    setCreateError(null);
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(newJson) as Record<string, unknown>;
    } catch {
      setCreateError("Invalid JSON");
      return;
    }
    setCreating(true);
    try {
      await createDocument(collection, data);
      setShowNewForm(false);
      setNewJson("{\n  \n}");
      const result = await listDocuments(collection, { limit: PAGE_SIZE, offset });
      setDocuments(result.items);
      setTotal(result.total);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create document");
    } finally {
      setCreating(false);
    }
  }

  async function handleUploadAsset(e: React.ChangeEvent<HTMLInputElement>) {
    if (!collection) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setCreating(true);
    setCreateError(null);
    try {
      await createAsset(collection, file);
      setShowNewForm(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      const result = await listDocuments(collection, { limit: PAGE_SIZE, offset });
      setDocuments(result.items);
      setTotal(result.total);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to upload asset");
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveSchema(e: React.FormEvent) {
    e.preventDefault();
    if (!collection) return;
    setSchemaSaving(true);
    setSchemaError(null);
    let parsed: unknown = null;
    if (schemaCollectionType !== "binary") {
      try {
        parsed = JSON.parse(schemaJson);
      } catch {
        setSchemaError("Invalid JSON");
        setSchemaSaving(false);
        return;
      }
    }
    try {
      await setCollectionSchema(collection, parsed, displayName || null, schemaCollectionType);
      setHasSchema(true);
      // Sync collectionType into documents tab
      setCollectionType(schemaCollectionType);
    } catch (err) {
      setSchemaError(err instanceof Error ? err.message : "Failed to save schema");
    } finally {
      setSchemaSaving(false);
    }
  }

  async function handleDeleteSchema() {
    if (!collection) return;
    setSchemaDeleting(true);
    setSchemaError(null);
    try {
      await deleteCollectionSchema(collection);
      setHasSchema(false);
      setSchemaJson("{\n  \"type\": \"object\",\n  \"properties\": {}\n}");
    } catch (err) {
      setSchemaError(err instanceof Error ? err.message : "Failed to delete schema");
    } finally {
      setSchemaDeleting(false);
    }
  }

  if (!collection) {
    return (
      <div>
        <h1 className="admin-page-title">Wren Admin</h1>
        <EmptyState
          title="No collection selected"
          description="Type a collection name in the sidebar and press Enter to browse documents."
        />
      </div>
    );
  }

  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + PAGE_SIZE, total);

  type DocRow = Document & { _dataPreview: string };

  const rows: DocRow[] = documents.map((doc) => ({
    ...doc,
    _dataPreview: docPreview(doc.data, displayName),
  }));

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  const columns = collectionType === "binary"
    ? [
        {
          key: "id" as const,
          header: "ID",
          render: (row: DocRow) => (
            <span style={{ fontFamily: "monospace", fontSize: 13 }}>{row.id.slice(0, 8)}</span>
          ),
        },
        {
          key: "_dataPreview" as const,
          header: "File",
          render: (row: DocRow) => {
            const d = row.data as { filename?: string; mimeType?: string; size?: number };
            const isImage = d.mimeType?.startsWith("image/");
            const rawUrl = getAssetRawUrl(collection, row.id, row.version);
            return (
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {isImage && (
                  <img
                    src={rawUrl}
                    alt={d.filename ?? ""}
                    style={{ width: 32, height: 32, objectFit: "cover", borderRadius: 4, border: "1px solid var(--wren-border)", flexShrink: 0 }}
                  />
                )}
                <span style={{ fontSize: 13 }}>{d.filename ?? "(unknown)"}</span>
                <span style={{ fontSize: 11, color: "var(--wren-text-muted)" }}>{d.mimeType}</span>
                {d.size !== undefined && (
                  <span style={{ fontSize: 11, color: "var(--wren-text-muted)" }}>{formatBytes(d.size)}</span>
                )}
                <a
                  href={rawUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 11, color: "var(--wren-link)", marginLeft: "auto", textDecoration: "none" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  download ↗
                </a>
              </span>
            );
          },
        },
        {
          key: "version" as const,
          header: "Version",
          render: (row: DocRow) => <span>v{row.version}</span>,
        },
        {
          key: "labels" as const,
          header: "Labels",
          render: (row: DocRow) => (
            <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {(row.labels ?? []).map(l => (
                <span key={l} className="wren-badge wren-badge--info" style={{ fontSize: 11 }}>{l}</span>
              ))}
            </span>
          ),
        },
        {
          key: "updatedAt" as const,
          header: "Updated At",
          render: (row: DocRow) => (
            <span style={{ fontSize: 13 }}>{new Date(row.updatedAt).toLocaleString()}</span>
          ),
        },
      ]
    : [
        {
          key: "id" as const,
          header: "ID",
          render: (row: DocRow) => (
            <span style={{ fontFamily: "monospace", fontSize: 13 }}>{row.id.slice(0, 8)}</span>
          ),
        },
        {
          key: "_dataPreview" as const,
          header: "Data",
          render: (row: DocRow) => (
            <span style={{ fontSize: 13, color: "var(--wren-text-muted)" }}>{row._dataPreview}</span>
          ),
        },
        {
          key: "version" as const,
          header: "Version",
          render: (row: DocRow) => <span>v{row.version}</span>,
        },
        {
          key: "labels" as const,
          header: "Labels",
          render: (row: DocRow) => (
            <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {(row.labels ?? []).map(l => (
                <span key={l} className="wren-badge wren-badge--info" style={{ fontSize: 11 }}>{l}</span>
              ))}
            </span>
          ),
        },
        {
          key: "updatedAt" as const,
          header: "Updated At",
          render: (row: DocRow) => (
            <span style={{ fontSize: 13 }}>{new Date(row.updatedAt).toLocaleString()}</span>
          ),
        },
      ];

  return (
    <div>
      <div className="admin-main__header">
        <h1 className="admin-page-title">
          {collection}
          {collectionType === "binary" && (
            <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 8, color: "var(--wren-text-muted)", background: "var(--wren-bg-subtle)", border: "1px solid var(--wren-border)", borderRadius: 4, padding: "2px 6px" }}>
              binary
            </span>
          )}
        </h1>
        {activeTab === "documents" && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => { setShowNewForm((v) => !v); setCreateError(null); }}
          >
            {showNewForm ? "Cancel" : collectionType === "binary" ? "Upload Asset" : "New Document"}
          </Button>
        )}
      </div>

      <Tabs
        tabs={[
          { key: "documents", label: "Documents" },
          { key: "schema", label: "Schema" },
        ]}
        active={activeTab}
        onChange={(k) => setTab(k as "documents" | "schema")}
      />

      <div className="admin-tab-content">
        {activeTab === "documents" && (
          <>
            {showNewForm && collectionType === "binary" && (
              <div className="admin-new-doc-form">
                <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>Upload Asset</div>
                {createError && <div className="admin-error">{createError}</div>}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="wren-input"
                    style={{ flex: 1 }}
                    disabled={creating}
                    onChange={handleUploadAsset}
                  />
                  {creating && <Spinner size="sm" />}
                </div>
                <div className="admin-new-doc-form__actions">
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setShowNewForm(false); setCreateError(null); }}>Cancel</Button>
                </div>
              </div>
            )}

            {showNewForm && collectionType !== "binary" && (
              <div className="admin-new-doc-form">
                <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>New Document (JSON)</div>
                {createError && <div className="admin-error">{createError}</div>}
                <form onSubmit={handleCreate}>
                  <textarea
                    value={newJson}
                    onChange={(e) => setNewJson(e.target.value)}
                    spellCheck={false}
                  />
                  <div className="admin-new-doc-form__actions">
                    <Button type="submit" variant="primary" size="sm" loading={creating}>Create</Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => { setShowNewForm(false); setCreateError(null); }}>Cancel</Button>
                  </div>
                </form>
              </div>
            )}

            {error && <div className="admin-error">{error}</div>}

            {loading ? (
              <div className="admin-spinner-center"><Spinner size="lg" /></div>
            ) : (
              <>
                <Card>
                  <Table
                    columns={columns}
                    rows={rows}
                    onRowClick={(row) => { window.location.hash = `#/collections/${collection}/${row.id}`; }}
                    emptyMessage="No documents in this collection."
                  />
                </Card>
                {total > 0 && (
                  <div className="admin-pagination">
                    <Button variant="secondary" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>Previous</Button>
                    <span>Showing {from}–{to} of {total}</span>
                    <Button variant="secondary" size="sm" disabled={to >= total} onClick={() => setOffset(offset + PAGE_SIZE)}>Next</Button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {activeTab === "schema" && (
          <Card title={hasSchema ? "Schema (enforced)" : "Schema (not set)"}>
            {schemaError && <div className="admin-error">{schemaError}</div>}
            {schemaLoading ? (
              <div className="admin-spinner-center"><Spinner size="lg" /></div>
            ) : (
              <form onSubmit={handleSaveSchema} className="admin-edit-form">
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                    Collection type
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {(["json", "binary"] as const).map((t) => (
                      <label key={t} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                        <input
                          type="radio"
                          name="collectionType"
                          value={t}
                          checked={schemaCollectionType === t}
                          onChange={() => setSchemaCollectionType(t)}
                        />
                        {t === "json" ? "JSON documents" : "Binary assets (files)"}
                      </label>
                    ))}
                  </div>
                </div>

                {schemaCollectionType !== "binary" && (
                  <>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                        Display name rule
                      </label>
                      <input
                        className="wren-input"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder='e.g. "{title}" or "{first} {last}" or "{slug} — {title}"'
                        style={{ width: "100%", fontFamily: "monospace" }}
                      />
                      <p style={{ fontSize: 12, color: "var(--wren-text-muted)", marginTop: 4 }}>
                        Use <code style={{ fontFamily: "monospace" }}>{"{fieldName}"}</code> placeholders.
                        Shown in the document list and tree picker instead of the raw first-field preview.
                      </p>
                    </div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                      JSON Schema
                    </label>
                    <textarea
                      value={schemaJson}
                      onChange={(e) => setSchemaJson(e.target.value)}
                      spellCheck={false}
                      style={{ minHeight: 280 }}
                    />
                  </>
                )}

                {schemaCollectionType === "binary" && (
                  <p style={{ fontSize: 13, color: "var(--wren-text-muted)", marginBottom: 12 }}>
                    Binary collections store file uploads. JSON schema validation is skipped.
                    Upload files via the Documents tab or <code style={{ fontFamily: "monospace" }}>wren upload {collection} &lt;file&gt;</code>.
                  </p>
                )}

                <div className="admin-edit-form__actions">
                  <Button type="submit" variant="primary" size="sm" loading={schemaSaving}>
                    {hasSchema ? "Update Schema" : "Set Schema"}
                  </Button>
                  {hasSchema && (
                    <ConfirmButton
                      label="Remove Schema"
                      confirmLabel="Yes, remove"
                      prompt="Remove schema from this collection?"
                      loading={schemaDeleting}
                      onConfirm={handleDeleteSchema}
                    />
                  )}
                </div>
              </form>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
