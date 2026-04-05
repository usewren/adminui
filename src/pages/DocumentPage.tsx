import React, { useEffect, useState } from "react";
import { Button, Badge, Tabs, Spinner, Card, JsonViewer, DiffViewer, Table } from "componentlibrary";
import {
  getDocument,
  updateDocument,
  deleteDocument,
  listVersions,
  setLabel,
  diffVersions,
  type Document,
  type VersionMeta,
  type DiffResult,
  type User,
} from "../api";

interface DocumentPageProps {
  collection: string;
  id: string;
  user: User;
}

type Tab = "data" | "versions" | "diff";

export function DocumentPage({ collection, id, user: _user }: DocumentPageProps) {
  const [doc, setDoc] = useState<Document | null>(null);
  const [versions, setVersions] = useState<VersionMeta[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("data");
  const [loading, setLoading] = useState(true);
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

  // Diff state
  const [diffV1, setDiffV1] = useState(1);
  const [diffV2, setDiffV2] = useState(1);
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      getDocument(collection, id),
      listVersions(collection, id),
    ])
      .then(([docResult, versionsResult]) => {
        if (cancelled) return;
        setDoc(docResult);
        setVersions(versionsResult.versions);
        setDiffV2(docResult.version);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load document");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [collection, id]);

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
      setVersions((prev) => [
        ...prev,
        { version: updated.version, createdAt: updated.updatedAt, createdBy: "" },
      ]);
      setDiffV2(updated.version);
      setEditing(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete document "${id}"? This cannot be undone.`)) return;
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
      await setLabel(collection, id, labelInput.trim());
      setLabelInput("");
    } catch (err) {
      setLabelError(err instanceof Error ? err.message : "Failed to set label");
    } finally {
      setLabelSaving(false);
    }
  }

  async function handleDiff(e: React.FormEvent) {
    e.preventDefault();
    setDiffError(null);
    setDiffResult(null);
    setDiffLoading(true);
    try {
      const result = await diffVersions(collection, id, diffV1, diffV2);
      setDiffResult(result);
    } catch (err) {
      setDiffError(err instanceof Error ? err.message : "Failed to compute diff");
    } finally {
      setDiffLoading(false);
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
    { key: "versions", label: "Versions" },
    { key: "diff", label: "Diff" },
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
        <span className="admin-meta">
          Created {new Date(doc.createdAt).toLocaleString()}
        </span>
        <span className="admin-meta">
          Updated {new Date(doc.updatedAt).toLocaleString()}
        </span>
      </div>

      <Tabs
        tabs={tabs}
        active={activeTab}
        onChange={(key) => setActiveTab(key as Tab)}
      />

      <div className="admin-tab-content">
        {activeTab === "data" && (
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
                  <Button variant="danger" size="sm" onClick={handleDelete}>
                    Delete
                  </Button>
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
                      onClick={() => {
                        setEditing(false);
                        setEditError(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </Card>
        )}

        {activeTab === "versions" && (
          <Card>
            <div className="admin-versions-table">
              <Table
                columns={[
                  {
                    key: "version",
                    header: "Version",
                    render: (row: VersionMeta) => <Badge label={`v${row.version}`} variant="blue" />,
                  },
                  {
                    key: "createdAt",
                    header: "Created At",
                    render: (row: VersionMeta) =>
                      row.createdAt ? new Date(row.createdAt).toLocaleString() : "—",
                  },
                  {
                    key: "createdBy",
                    header: "Created By",
                    render: (row: VersionMeta) => row.createdBy || "—",
                  },
                ]}
                rows={versions}
                emptyMessage="No version history available."
              />
              <p style={{ fontSize: 12, color: "var(--wren-text-muted)", marginTop: 12 }}>
                Note: Viewing a specific version's data requires fetching it individually. Use the Diff tab to compare versions.
              </p>
            </div>
          </Card>
        )}

        {activeTab === "diff" && (
          <Card>
            <form className="admin-diff-controls" onSubmit={handleDiff}>
              <div>
                <label style={{ fontSize: 13, display: "block", marginBottom: 4 }}>From version</label>
                <input
                  className="wren-input"
                  type="number"
                  min={1}
                  max={doc.version}
                  value={diffV1}
                  onChange={(e) => setDiffV1(Number(e.target.value))}
                  style={{ width: 80 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 13, display: "block", marginBottom: 4 }}>To version</label>
                <input
                  className="wren-input"
                  type="number"
                  min={1}
                  max={doc.version}
                  value={diffV2}
                  onChange={(e) => setDiffV2(Number(e.target.value))}
                  style={{ width: 80 }}
                />
              </div>
              <Button type="submit" variant="primary" size="sm" loading={diffLoading}>
                Compare
              </Button>
            </form>

            {diffError && <div className="admin-error">{diffError}</div>}

            {diffLoading && (
              <div className="admin-spinner-center">
                <Spinner />
              </div>
            )}

            {diffResult && !diffLoading && (
              <>
                {diffResult.diff.length === 0 ? (
                  <p style={{ color: "var(--wren-text-muted)", fontSize: 14 }}>No differences.</p>
                ) : (
                  <DiffViewer diff={diffResult.diff} />
                )}
              </>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
