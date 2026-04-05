import React, { useEffect, useState } from "react";
import { Button, Table, Spinner, EmptyState, Card } from "componentlibrary";
import { listDocuments, createDocument, type Document, type User } from "../api";

interface CollectionPageProps {
  collection: string | null;
  user: User;
}

const PAGE_SIZE = 20;

export function CollectionPage({ collection, user: _user }: CollectionPageProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newJson, setNewJson] = useState("{\n  \n}");
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setOffset(0);
  }, [collection]);

  useEffect(() => {
    if (!collection) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    listDocuments(collection, { limit: PAGE_SIZE, offset })
      .then((result) => {
        if (cancelled) return;
        setDocuments(result.items);
        setTotal(result.total);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load documents");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [collection, offset]);

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
      // Refresh
      const result = await listDocuments(collection, { limit: PAGE_SIZE, offset });
      setDocuments(result.items);
      setTotal(result.total);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create document");
    } finally {
      setCreating(false);
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

  const rows: DocRow[] = documents.map((doc) => {
    const firstKey = Object.keys(doc.data)[0];
    const preview = firstKey
      ? `${firstKey}: ${JSON.stringify(doc.data[firstKey])}`
      : "(empty)";
    return { ...doc, _dataPreview: preview };
  });

  const columns = [
    {
      key: "id" as const,
      header: "ID",
      render: (row: DocRow) => (
        <span style={{ fontFamily: "monospace", fontSize: 13 }}>
          {row.id.slice(0, 8)}
        </span>
      ),
    },
    {
      key: "_dataPreview" as const,
      header: "Data",
      render: (row: DocRow) => (
        <span style={{ fontSize: 13, color: "var(--wren-text-muted)" }}>
          {row._dataPreview}
        </span>
      ),
    },
    {
      key: "version" as const,
      header: "Version",
      render: (row: DocRow) => <span>v{row.version}</span>,
    },
    {
      key: "updatedAt" as const,
      header: "Updated At",
      render: (row: DocRow) => (
        <span style={{ fontSize: 13 }}>
          {new Date(row.updatedAt).toLocaleString()}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="admin-main__header">
        <h1 className="admin-page-title">{collection}</h1>
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            setShowNewForm((v) => !v);
            setCreateError(null);
          }}
        >
          {showNewForm ? "Cancel" : "New Document"}
        </Button>
      </div>

      {showNewForm && (
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
              <Button type="submit" variant="primary" size="sm" loading={creating}>
                Create
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowNewForm(false);
                  setCreateError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {error && <div className="admin-error">{error}</div>}

      {loading ? (
        <div className="admin-spinner-center">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          <Card>
            <Table
              columns={columns}
              rows={rows}
              onRowClick={(row) => {
                window.location.hash = `#/collections/${collection}/${row.id}`;
              }}
              emptyMessage="No documents in this collection."
            />
          </Card>
          {total > 0 && (
            <div className="admin-pagination">
              <Button
                variant="secondary"
                size="sm"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              >
                Previous
              </Button>
              <span>
                Showing {from}–{to} of {total}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={to >= total}
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
