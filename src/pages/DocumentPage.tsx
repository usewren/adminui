import React, { useEffect, useRef, useState } from "react";
import { Button, Badge, Tabs, Spinner, Card, JsonViewer } from "componentlibrary";
import { ConfirmButton } from "../ConfirmButton";
import {
  getDocument,
  getVersionData,
  updateDocument,
  updateAsset,
  deleteDocument,
  listVersions,
  listDocumentPaths,
  setLabel as apiSetLabel,
  diffVersions,
  getAssetRawUrl,
  type Document,
  type VersionMeta,
  type DiffEntry,
  type User,
} from "../api";

interface DocumentPageProps {
  collection: string;
  id: string;
  tab?: "data" | "history" | "paths";
  user: User;
}

type Tab = "data" | "history" | "paths";

// -------------------------------------------------------
// Version timeline
// -------------------------------------------------------

interface VersionWithDiff extends VersionMeta {
  diff: DiffEntry[] | null; // null = not yet loaded, [] = no changes (v1 create)
  v1data?: Record<string, unknown>; // only for version 1 (created with)
}

function fieldLabel(path: string): string {
  return path.replace(/^\//, "").replace(/_/g, " ");
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function LabelForm({ collection, id, version }: { collection: string; id: string; version: number }) {
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await apiSetLabel(collection, id, label.trim(), version);
      setLabel("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="vt-label-form" onSubmit={handleSubmit}>
      <input
        className="wren-input"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Set label…"
      />
      <button
        className="wren-btn wren-btn--secondary wren-btn--sm"
        type="submit"
        disabled={saving || !label.trim()}
      >
        {saving ? "…" : saved ? "✓" : "Set"}
      </button>
      {error && <span className="vt-label-error">{error}</span>}
    </form>
  );
}

function VersionTimeline({
  versions,
  loading,
  collection,
  id,
}: {
  versions: VersionWithDiff[];
  loading: boolean;
  collection: string;
  id: string;
}) {
  if (loading) {
    return (
      <div className="admin-spinner-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (versions.length === 0) {
    return <p style={{ color: "var(--wren-text-muted)", fontSize: 14 }}>No version history.</p>;
  }

  return (
    <div className="vt">
      {versions.map((v, i) => {
        const isLast = i === versions.length - 1;
        const isCreate = v.version === 1;
        const dotClass = isCreate ? "vt-dot--created" : "vt-dot--updated";

        return (
          <div key={v.version} className={`vt-item${isLast ? " vt-item--last" : ""}`}>
            <div className="vt-dot-col">
              <div className={`vt-dot ${dotClass}`} />
              {!isLast && <div className="vt-line" />}
            </div>
            <div className="vt-card">
              <div className="vt-card-header">
                <Badge label={`v${v.version}`} variant="blue" />
                <span className="vt-badge-op">{isCreate ? "created" : "updated"}</span>
                <span className="vt-time">
                  {v.createdAt ? new Date(v.createdAt).toLocaleString() : "—"}
                </span>
                {v.createdBy && (
                  <span className="vt-by">by {v.createdBy.slice(0, 8)}</span>
                )}
              </div>

              {/* v1: show the initial data fields */}
              {isCreate && v.v1data && Object.keys(v.v1data).length > 0 && (
                <div className="vt-changes">
                  {Object.entries(v.v1data).map(([key, val]) => (
                    <div key={key} className="vt-change">
                      <span className="vt-field">{key}</span>
                      <span className="vt-to">{formatValue(val)}</span>
                    </div>
                  ))}
                </div>
              )}

              <LabelForm collection={collection} id={id} version={v.version} />

              {/* v2+: show diff */}
              {!isCreate && v.diff === null && (
                <p className="vt-loading">Loading changes…</p>
              )}
              {!isCreate && v.diff !== null && v.diff.length === 0 && (
                <p className="vt-no-changes">No field changes</p>
              )}
              {!isCreate && v.diff !== null && v.diff.length > 0 && (
                <div className="vt-changes">
                  {v.diff.map((entry) => (
                    <div key={entry.path} className="vt-change">
                      <span className="vt-field">{fieldLabel(entry.path)}</span>
                      {entry.op === "remove" || entry.op === "replace" ? (
                        <span className="vt-from">{formatValue(entry.oldValue)}</span>
                      ) : null}
                      {(entry.op === "replace" || entry.op === "add") && entry.oldValue !== undefined ? (
                        <span className="vt-arrow">→</span>
                      ) : null}
                      {entry.op !== "remove" ? (
                        <span className="vt-to">{formatValue(entry.value)}</span>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// -------------------------------------------------------
// Asset preview
// -------------------------------------------------------

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function AssetPreview({
  collection,
  id,
  version,
  filename,
  mimeType,
  size,
  onReplaced,
}: {
  collection: string;
  id: string;
  version: number;
  filename: string;
  mimeType: string;
  size: number;
  onReplaced: (doc: Document) => void;
}) {
  const rawUrl = getAssetRawUrl(collection, id, version);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [replacing, setReplacing] = useState(false);
  const [replaceError, setReplaceError] = useState<string | null>(null);

  async function handleReplace(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setReplacing(true);
    setReplaceError(null);
    try {
      const updated = await updateAsset(collection, id, file);
      onReplaced(updated);
    } catch (err) {
      setReplaceError(err instanceof Error ? err.message : "Failed to replace");
    } finally {
      setReplacing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const isImage = mimeType.startsWith("image/");
  const isVideo = mimeType.startsWith("video/");
  const isAudio = mimeType.startsWith("audio/");
  const isPdf   = mimeType === "application/pdf";
  const isText  = mimeType.startsWith("text/");

  return (
    <Card>
      {/* Action bar */}
      <div className="admin-doc-actions">
        <input ref={fileInputRef} type="file" style={{ display: "none" }} onChange={handleReplace} />
        <Button variant="secondary" size="sm" loading={replacing} onClick={() => fileInputRef.current?.click()}>
          Replace file
        </Button>
        <a href={rawUrl} download={filename} style={{ textDecoration: "none" }}>
          <Button variant="secondary" size="sm">Download</Button>
        </a>
      </div>

      {replaceError && <div className="admin-error" style={{ marginBottom: 12 }}>{replaceError}</div>}

      {/* Visual preview */}
      {isImage && (
        <div style={{ textAlign: "center", margin: "16px 0", background: "var(--wren-bg-subtle)", borderRadius: 8, padding: 16, border: "1px solid var(--wren-border)" }}>
          <img src={rawUrl} alt={filename} style={{ maxWidth: "100%", maxHeight: 480, objectFit: "contain", borderRadius: 4 }} />
        </div>
      )}
      {isVideo && (
        <div style={{ margin: "16px 0" }}>
          <video src={rawUrl} controls style={{ width: "100%", maxHeight: 480, borderRadius: 8, background: "#000" }} />
        </div>
      )}
      {isAudio && (
        <div style={{ margin: "16px 0" }}>
          <audio src={rawUrl} controls style={{ width: "100%" }} />
        </div>
      )}
      {isPdf && (
        <div style={{ margin: "16px 0" }}>
          <iframe src={rawUrl} style={{ width: "100%", height: 600, border: "1px solid var(--wren-border)", borderRadius: 8 }} title={filename} />
        </div>
      )}
      {isText && (
        <div style={{ margin: "16px 0", padding: 12, background: "var(--wren-bg-subtle)", borderRadius: 8, border: "1px solid var(--wren-border)", fontFamily: "monospace", fontSize: 12, whiteSpace: "pre-wrap", maxHeight: 400, overflow: "auto" }}>
          <TextPreview url={rawUrl} />
        </div>
      )}
      {!isImage && !isVideo && !isAudio && !isPdf && !isText && (
        <div style={{ margin: "16px 0", padding: 24, background: "var(--wren-bg-subtle)", borderRadius: 8, border: "1px solid var(--wren-border)", textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📄</div>
          <div style={{ fontSize: 14, color: "var(--wren-text-muted)" }}>No preview available</div>
        </div>
      )}

      {/* Metadata strip */}
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: 13, color: "var(--wren-text-muted)", borderTop: "1px solid var(--wren-border)", paddingTop: 10, marginTop: 4 }}>
        <span><strong style={{ color: "var(--wren-text)" }}>File</strong> {filename}</span>
        <span><strong style={{ color: "var(--wren-text)" }}>Type</strong> {mimeType}</span>
        <span><strong style={{ color: "var(--wren-text)" }}>Size</strong> {formatBytes(size)}</span>
        <span><strong style={{ color: "var(--wren-text)" }}>Version</strong> v{version}</span>
        <a href={rawUrl} target="_blank" rel="noreferrer" style={{ marginLeft: "auto", fontSize: 12, color: "var(--wren-link)" }}>open raw ↗</a>
      </div>
    </Card>
  );
}

function TextPreview({ url }: { url: string }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    fetch(url, { credentials: "include" })
      .then((r) => r.text())
      .then(setText)
      .catch(() => setText("(failed to load)"));
  }, [url]);
  if (text === null) return <span style={{ color: "var(--wren-text-muted)" }}>Loading…</span>;
  return <>{text}</>;
}

// -------------------------------------------------------
// Main page
// -------------------------------------------------------

export function DocumentPage({ collection, id, tab: tabProp, user: _user }: DocumentPageProps) {
  const [doc, setDoc] = useState<Document | null>(null);
  const [versions, setVersions] = useState<VersionWithDiff[]>([]);

  // Detect binary asset from data envelope
  const isBinary = !!(doc?.data as { _binary?: boolean })?._binary;
  const assetMeta = isBinary
    ? (doc!.data as { filename: string; mimeType: string; size: number })
    : null;

  const activeTab: Tab = tabProp ?? "data";

  function setActiveTab(t: Tab) {
    const base = `#/collections/${collection}/${id}`;
    if (t === "history") window.location.hash = `${base}?tab=history`;
    else if (t === "paths") window.location.hash = `${base}?tab=paths`;
    else window.location.hash = base;
  }
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editJson, setEditJson] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Label state
  const [labelInput, setLabelInput] = useState("");
  const [labelError, setLabelError] = useState<string | null>(null);
  const [labelSaving, setLabelSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getDocument(collection, id)
      .then((docResult) => {
        if (cancelled) return;
        setDoc(docResult);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load document");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [collection, id]);

  // Load version history + diffs when History tab is opened
  useEffect(() => {
    if (activeTab !== "history" || !doc) return;

    let cancelled = false;
    setHistoryLoading(true);

    listVersions(collection, id)
      .then(async (result) => {
        if (cancelled) return;

        // Show newest first, with null diffs initially
        const ordered: VersionWithDiff[] = [...result.versions]
          .reverse()
          .map((v) => ({ ...v, diff: null }));

        setVersions(ordered);
        setHistoryLoading(false);

        // Fetch v1 data and all consecutive diffs in parallel
        const fetches = ordered.map(async (v) => {
          if (v.version === 1) {
            const data = await getVersionData(collection, id, 1);
            return { version: 1, diff: [] as DiffEntry[], v1data: data.data };
          } else {
            const result = await diffVersions(collection, id, v.version - 1, v.version);
            return { version: v.version, diff: result.diff };
          }
        });

        // Apply each result as it arrives
        for (const fetch of fetches) {
          fetch.then((resolved) => {
            if (cancelled) return;
            setVersions((prev) =>
              prev.map((v) =>
                v.version === resolved.version
                  ? { ...v, diff: resolved.diff, v1data: (resolved as { v1data?: Record<string, unknown> }).v1data }
                  : v
              )
            );
          }).catch(() => {
            // leave diff as null on error
          });
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load history");
        setHistoryLoading(false);
      });

    return () => { cancelled = true; };
  }, [activeTab, collection, id, doc]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setEditError(null);
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(editJson) as Record<string, unknown>;
    } catch {
      setEditError("Invalid JSON");
      return;
    }
    setSaving(true);
    try {
      const updated = await updateDocument(collection, id, data);
      setDoc(updated);
      setEditing(false);
      // Reset history so it reloads fresh next time
      setVersions([]);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    try {
      await deleteDocument(collection, id);
      window.location.hash = `#/collections/${collection}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  async function handleSetLabel(e: React.FormEvent) {
    e.preventDefault();
    if (!labelInput.trim()) return;
    setLabelError(null);
    setLabelSaving(true);
    try {
      await apiSetLabel(collection, id, labelInput.trim());
      setLabelInput("");
    } catch (err) {
      setLabelError(err instanceof Error ? err.message : "Failed to set label");
    } finally {
      setLabelSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="admin-spinner-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return <div className="admin-error">{error}</div>;
  }

  if (!doc) return null;

  const tabs = [
    { key: "data", label: "Data" },
    { key: "history", label: `History (v${doc.version})` },
    { key: "paths", label: "Tree paths" },
  ];

  return (
    <div>
      <a
        className="admin-back-link"
        onClick={(e) => {
          e.preventDefault();
          window.location.hash = `#/collections/${collection}`;
        }}
        href={`#/collections/${collection}`}
      >
        ← {collection}
      </a>

      <div className="admin-doc-header">
        <h1 className="admin-page-title" style={{ fontFamily: "monospace", fontSize: 18 }}>
          {doc.id}
        </h1>
        <Badge label={`v${doc.version}`} variant="blue" />
        <span className="admin-meta">Created {new Date(doc.createdAt).toLocaleString()}</span>
        <span className="admin-meta">Updated {new Date(doc.updatedAt).toLocaleString()}</span>
      </div>

      <Tabs tabs={tabs} active={activeTab} onChange={(key) => setActiveTab(key as Tab)} />

      <div className="admin-tab-content">
        {activeTab === "data" && (
          <>
            {/* Binary asset: preview card on top */}
            {isBinary && assetMeta && (
              <AssetPreview
                collection={collection}
                id={id}
                version={doc.version}
                filename={assetMeta.filename}
                mimeType={assetMeta.mimeType}
                size={assetMeta.size}
                onReplaced={(updated) => { setDoc(updated); setVersions([]); }}
              />
            )}

            {/* JSON data card (always shown — metadata envelope for binary, full data for JSON) */}
            <div style={{ marginTop: isBinary ? 16 : 0 }}>
            <Card>
              {!editing ? (
                <>
                  <div className="admin-doc-actions">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setEditJson(JSON.stringify(doc.data, null, 2));
                        setEditError(null);
                        setEditing(true);
                      }}
                    >
                      Edit
                    </Button>
                    <ConfirmButton
                      label="Delete"
                      confirmLabel="Yes, delete"
                      prompt="Delete this document?"
                      onConfirm={handleDelete}
                    />
                  </div>

                  <JsonViewer data={doc.data} />

                  <div style={{ marginTop: 20 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Set Label</div>
                    {labelError && <div className="admin-error">{labelError}</div>}
                    <form className="admin-label-form" onSubmit={handleSetLabel}>
                      <input
                        className="wren-input"
                        value={labelInput}
                        onChange={(e) => setLabelInput(e.target.value)}
                        placeholder="e.g. published"
                        style={{ flex: 1, minWidth: 160 }}
                      />
                      <Button type="submit" variant="secondary" size="sm" loading={labelSaving}>
                        Set label
                      </Button>
                    </form>
                  </div>
                </>
              ) : (
                <div className="admin-edit-form">
                  {editError && <div className="admin-error">{editError}</div>}
                  <form onSubmit={handleSave}>
                    <textarea
                      value={editJson}
                      onChange={(e) => setEditJson(e.target.value)}
                      spellCheck={false}
                    />
                    <div className="admin-edit-form__actions">
                      <Button type="submit" variant="primary" size="sm" loading={saving}>
                        Save
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => { setEditing(false); setEditError(null); }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </div>
              )}
            </Card>
            </div>
          </>
        )}

        {activeTab === "history" && (
          <VersionTimeline versions={versions} loading={historyLoading} collection={collection} id={id} />
        )}

        {activeTab === "paths" && (
          <PathsPanel collection={collection} id={id} />
        )}
      </div>
    </div>
  );
}

function PathsPanel({ collection, id }: { collection: string; id: string }) {
  const [paths, setPaths] = useState<{ tree: string; path: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    listDocumentPaths(collection, id)
      .then((r) => setPaths(r.paths))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [collection, id]);

  if (loading) return <div className="admin-spinner-center"><Spinner size="lg" /></div>;
  if (error) return <div className="admin-error">{error}</div>;

  return (
    <Card title="Tree paths">
      {paths.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--wren-text-muted)" }}>
          This document has not been assigned to any tree path.
        </p>
      ) : (
        <div className="tree-children">
          {paths.map((p) => (
            <div
              key={`${p.tree}:${p.path}`}
              className="tree-child"
              style={{ cursor: "pointer" }}
              onClick={() => { window.location.hash = `#/tree/${p.tree}${p.path}`; }}
            >
              <span style={{ fontSize: 12, color: "var(--wren-text-muted)", minWidth: 60 }}>{p.tree}</span>
              <span className="tree-child__segment">{p.path}</span>
              <span style={{ fontSize: 11, color: "var(--wren-text-muted)", marginLeft: "auto" }}>open in tree →</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
