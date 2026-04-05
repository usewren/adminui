import React, { useEffect, useState } from "react";
import { Button, Spinner, Card, JsonViewer, Badge, Tabs } from "componentlibrary";
import { ConfirmButton } from "../ConfirmButton";
import {
  getTreeNode,
  setTreePath,
  deleteTreePath,
  listTrees,
  listCollections,
  listDocuments,
  createDocument,
  getCollectionSchema,
  type TreeNode,
  type TreeInfo,
  type Document,
  type CollectionInfo,
  type User,
} from "../api";
import { applyDisplayRule } from "./CollectionPage";
import { TreeFullView } from "./TreeFullView";

interface TreePageProps {
  treeName: string;
  path: string;
  view?: "browse" | "full";
  user: User;
}

// Reusable picker: browse a collection and pick a doc, or create a new one
function DocPicker({
  onPick,
  loading: outerLoading,
}: {
  onPick: (docId: string) => Promise<void>;
  loading: boolean;
}) {
  const [mode, setMode] = useState<"browse" | "create">("browse");
  const [collections, setCollections] = useState<CollectionInfo[]>([]);
  const [selectedCollection, setSelectedCollection] = useState("");
  const [docs, setDocs] = useState<Document[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [displayRule, setDisplayRule] = useState("");
  const [newJson, setNewJson] = useState("{\n  \n}");
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    listCollections().then(setCollections).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedCollection) { setDocs([]); setDisplayRule(""); return; }
    setDocsLoading(true);
    Promise.all([
      listDocuments(selectedCollection, { limit: 50 }),
      getCollectionSchema(selectedCollection),
    ])
      .then(([r, schema]) => {
        setDocs(r.items);
        setDisplayRule(schema?.displayName ?? "");
      })
      .catch(() => setDocs([]))
      .finally(() => setDocsLoading(false));
  }, [selectedCollection]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCollection) { setCreateError("Select a collection"); return; }
    setCreateError(null);
    let data: Record<string, unknown>;
    try { data = JSON.parse(newJson) as Record<string, unknown>; }
    catch { setCreateError("Invalid JSON"); return; }
    setCreating(true);
    try {
      const doc = await createDocument(selectedCollection, data);
      await onPick(doc.id);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed");
    } finally {
      setCreating(false);
    }
  }

  const collectionSelect = (
    <select
      className="wren-input"
      value={selectedCollection}
      onChange={(e) => setSelectedCollection(e.target.value)}
      style={{ marginBottom: 10 }}
    >
      <option value="">Select collection…</option>
      {collections.map((c) => (
        <option key={c.name} value={c.name}>{c.name} ({c.count})</option>
      ))}
    </select>
  );

  return (
    <div>
      <Tabs
        tabs={[{ key: "browse", label: "Browse existing" }, { key: "create", label: "Create new" }]}
        active={mode}
        onChange={(k) => setMode(k as "browse" | "create")}
      />
      <div style={{ marginTop: 12 }}>
        {mode === "browse" && (
          <>
            {collectionSelect}
            {docsLoading && <div style={{ fontSize: 13, color: "var(--wren-text-muted)" }}>Loading…</div>}
            {!docsLoading && selectedCollection && docs.length === 0 && (
              <div style={{ fontSize: 13, color: "var(--wren-text-muted)" }}>No documents in this collection.</div>
            )}
            {docs.map((doc) => {
              const preview = displayRule
                ? applyDisplayRule(displayRule, doc.data)
                : (() => { const k = Object.keys(doc.data)[0]; return k ? `${k}: ${JSON.stringify(doc.data[k])}` : "(empty)"; })();
              return (
                <div
                  key={doc.id}
                  className="tree-child"
                  style={{ marginBottom: 4 }}
                  onClick={() => !outerLoading && onPick(doc.id)}
                >
                  <span style={{ fontFamily: "var(--wren-mono)", fontSize: 12 }}>{doc.id.slice(0, 8)}…</span>
                  <span style={{ fontSize: 12, color: "var(--wren-text-muted)", flex: 1, marginLeft: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preview}</span>
                  <Badge label={`v${doc.version}`} variant="blue" />
                </div>
              );
            })}
          </>
        )}
        {mode === "create" && (
          <form onSubmit={handleCreate}>
            {collectionSelect}
            {createError && <div className="admin-error">{createError}</div>}
            <textarea
              className="admin-edit-form"
              value={newJson}
              onChange={(e) => setNewJson(e.target.value)}
              spellCheck={false}
              style={{ width: "100%", boxSizing: "border-box", fontFamily: "monospace", fontSize: 13, border: "1px solid var(--wren-border)", borderRadius: 6, padding: 8, minHeight: 140, resize: "vertical", background: "var(--wren-bg-subtle)" }}
            />
            <div style={{ marginTop: 8 }}>
              <Button type="submit" variant="primary" size="sm" loading={creating || outerLoading}>
                Create &amp; assign
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export function TreePage({ treeName, path, view }: TreePageProps) {
  const [node, setNode] = useState<TreeNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trees, setTrees] = useState<TreeInfo[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [newSegment, setNewSegment] = useState("");

  const viewMode = view ?? "browse";

  function setViewMode(v: "browse" | "full") {
    const base = `#/tree/${treeName}${path}`;
    window.location.hash = v === "full" ? `${base}?view=full` : base;
  }

  function load(tn: string, p: string) {
    setLoading(true);
    setError(null);
    setNode(null);
    getTreeNode(tn, p)
      .then(setNode)
      .catch((err) => setError(err instanceof Error ? err.message : "Not found"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { listTrees().then(setTrees).catch(() => {}); }, []);
  useEffect(() => { setShowPicker(false); load(treeName, path); }, [treeName, path]);

  async function handlePick(docId: string) {
    setAssigning(true);
    setAssignError(null);
    try {
      await setTreePath(treeName, path, docId);
      setShowPicker(false);
      load(treeName, path);
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : "Failed");
    } finally {
      setAssigning(false);
    }
  }

  async function handleRemove() {
    setRemoving(true);
    try {
      await deleteTreePath(treeName, path);
      const parent = path.split("/").slice(0, -1).join("/") || "/";
      window.location.hash = `#/tree/${treeName}${parent}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove");
    } finally {
      setRemoving(false);
    }
  }

  const segments = path.split("/").filter(Boolean);
  const breadcrumbs = segments.map((seg, i) => ({
    label: seg,
    path: "/" + segments.slice(0, i + 1).join("/"),
  }));

  return (
    <div>
      {/* Tree picker + view mode toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {trees.map((t) => (
          <span
            key={t.name}
            className={`admin-sidebar__section-link${t.name === treeName ? " admin-sidebar__section-link--active" : ""}`}
            style={{ cursor: "pointer" }}
            onClick={() => { window.location.hash = `#/tree/${t.name}/`; }}
          >
            {t.name} <span style={{ opacity: 0.6, fontSize: 11 }}>{t.count}</span>
          </span>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          <Button
            variant={viewMode === "browse" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setViewMode("browse")}
          >
            Browse
          </Button>
          <Button
            variant={viewMode === "full" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setViewMode("full")}
          >
            Tree view
          </Button>
        </div>
      </div>

      {/* Full tree view */}
      {viewMode === "full" && (
        <Card title={`${treeName} — full tree`}>
          <TreeFullView treeName={treeName} />
        </Card>
      )}

      {/* Browse mode */}
      {viewMode === "browse" && (
        <>
          {/* Breadcrumb */}
          <div className="tree-breadcrumb">
            <span
              className="tree-breadcrumb__item tree-breadcrumb__item--link"
              onClick={() => { window.location.hash = `#/tree/${treeName}/`; }}
            >
              {treeName}:/
            </span>
            {breadcrumbs.map((b, i) => (
              <React.Fragment key={b.path}>
                <span className="tree-breadcrumb__sep">›</span>
                <span
                  className={`tree-breadcrumb__item${i === breadcrumbs.length - 1 ? " tree-breadcrumb__item--active" : " tree-breadcrumb__item--link"}`}
                  onClick={() => { if (i < breadcrumbs.length - 1) window.location.hash = `#/tree/${treeName}${b.path}`; }}
                >
                  {b.label}
                </span>
              </React.Fragment>
            ))}
          </div>

          <div className="admin-main__header">
            <h1 className="admin-page-title tree-path-title">{path || "/"}</h1>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {node?.assignmentDocId && (
                <span
                  style={{ fontSize: 12, color: "var(--wren-text-muted)", cursor: "pointer", textDecoration: "underline" }}
                  onClick={() => { window.location.hash = `#/collections/_paths/${node!.assignmentDocId}`; }}
                >
                  assignment history
                </span>
              )}
              {node?.document && (
                <Button variant="secondary" size="sm" onClick={() => setShowPicker((v) => !v)}>
                  {showPicker ? "Cancel" : "Reassign"}
                </Button>
              )}
              {node?.document && (
                <ConfirmButton
                  label="Remove"
                  confirmLabel="Yes, remove"
                  prompt={`Remove "${path}" from ${treeName}?`}
                  loading={removing}
                  onConfirm={handleRemove}
                />
              )}
            </div>
          </div>

          {loading && <div className="admin-spinner-center"><Spinner size="lg" /></div>}

          {!loading && (
            <>
              {/* Document at this path */}
              {node?.document ? (
                <Card title="Document at this path">
                  <div className="tree-doc-meta">
                    <Badge label={`v${node.document.version}`} variant="blue" />
                    <span
                      className="tree-doc-link"
                      onClick={() => {
                        window.location.hash = `#/collections/${node!.document!.collection}/${node!.document!.id}`;
                      }}
                    >
                      {node.document.collection} / {node.document.id.slice(0, 8)}…
                    </span>
                  </div>
                  <JsonViewer data={node.document.data} />
                </Card>
              ) : (
                <Card title={`Assign a document to ${path}`}>
                  <p style={{ fontSize: 13, color: "var(--wren-text-muted)", marginBottom: 12 }}>
                    You're now at <code style={{ fontFamily: "monospace" }}>{treeName}:{path}</code>.
                    Pick an existing document or create a new one to assign it here.
                  </p>
                  {assignError && <div className="admin-error">{assignError}</div>}
                  <DocPicker onPick={handlePick} loading={assigning} />
                </Card>
              )}

              {/* Reassign picker (only shown when a doc is already here) */}
              {showPicker && node?.document && (
                <Card title="Reassign path">
                  {assignError && <div className="admin-error">{assignError}</div>}
                  <DocPicker onPick={handlePick} loading={assigning} />
                </Card>
              )}

              {/* Children */}
              <Card title="Children">
                {(node?.children?.length ?? 0) > 0 ? (
                  <div className="tree-children" style={{ marginBottom: 16 }}>
                    {node!.children.map((child) => {
                      const childLabel = child.path.split("/").filter(Boolean).pop() ?? child.path;
                      return (
                        <div
                          key={child.path}
                          className="tree-child"
                          style={{ cursor: "pointer" }}
                          onClick={() => { window.location.hash = `#/tree/${treeName}${child.path}`; }}
                        >
                          <span className="tree-child__segment">/{childLabel}</span>
                          <span className="tree-child__id">{child.documentId.slice(0, 8)}…</span>
                          <span style={{ fontSize: 11, color: "var(--wren-text-muted)", marginLeft: "auto" }}>click to open →</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{ fontSize: 13, color: "var(--wren-text-muted)", marginBottom: 12 }}>
                    No children yet.
                  </p>
                )}
                <p style={{ fontSize: 12, color: "var(--wren-text-muted)", marginBottom: 6 }}>
                  Type a path segment and click <strong>Go →</strong> to navigate there and assign a document.
                </p>
                <form
                  style={{ display: "flex", gap: 8 }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const seg = newSegment.trim().replace(/^\/+|\/+$/g, "");
                    if (!seg) return;
                    const childPath = (path === "/" ? "" : path) + "/" + seg;
                    setNewSegment("");
                    window.location.hash = `#/tree/${treeName}${childPath}`;
                  }}
                >
                  <input
                    className="wren-input"
                    placeholder="e.g. products, about, en"
                    value={newSegment}
                    onChange={(e) => setNewSegment(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <Button type="submit" variant="primary" size="sm">Go →</Button>
                </form>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
