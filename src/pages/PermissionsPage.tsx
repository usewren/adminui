import React, { useEffect, useState } from "react";
import {
  listPermissions, createPermission, updatePermission, deletePermission,
  listMembers, listApiKeys,
  type Permission, type PermissionCreate,
  type Member, type ApiKey,
  ApiError,
} from "../api";
import { ConfirmButton } from "../ConfirmButton";

const ACCESS_LEVELS = ["none", "read", "write", "admin"] as const;
const FILTER_LANGS  = ["jq", "jmespath", "jsonata"] as const;

function accessBadge(access: string) {
  const cls: Record<string, string> = {
    none:  "wren-badge--neutral",
    read:  "wren-badge--info",
    write: "wren-badge--warning",
    admin: "wren-badge--error",
  };
  return <span className={`wren-badge ${cls[access] ?? ""}`}>{access}</span>;
}

const BLANK: PermissionCreate = {
  principal: "",
  resource: "",
  access: "read",
  labelFilter: null,
  filterLang: null,
  filterExpr: null,
  auditReads: false,
  auditWrites: false,
};

export function PermissionsPage() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [form, setForm] = useState<PermissionCreate>({ ...BLANK });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editPatch, setEditPatch] = useState<Partial<PermissionCreate>>({});

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [perms, mems, ks] = await Promise.all([
        listPermissions(),
        listMembers().catch(() => [] as Member[]),
        listApiKeys().catch(() => [] as ApiKey[]),
      ]);
      setPermissions(perms);
      setMembers(mems);
      setKeys(ks.filter(k => !k.revokedAt));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const created = await createPermission(form);
      setPermissions(p => [created, ...p]);
      setForm({ ...BLANK });
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Failed to create permission");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    await deletePermission(id);
    setPermissions(p => p.filter(x => x.id !== id));
  }

  async function handleSaveEdit(id: string) {
    const updated = await updatePermission(id, editPatch);
    setPermissions(p => p.map(x => x.id === id ? updated : x));
    setEditId(null);
    setEditPatch({});
  }

  // Build principal options from members + keys
  const principalOptions: { value: string; label: string }[] = [
    ...members.map(m => ({ value: `member:${m.userId}`, label: `member: ${m.name} <${m.email}>` })),
    ...keys.map(k => ({ value: `key:${k.id}`, label: `key: ${k.name} (${k.keyPrefix}…)` })),
  ];

  const resourceExamples = [
    "*",
    "collection:*",
    "tree:*",
  ];

  if (loading) return <div className="wren-loading">Loading…</div>;

  return (
    <div className="wren-page">
      <div className="wren-page__header">
        <h1 className="wren-page__title">Permissions</h1>
        <p className="wren-page__subtitle">
          Control what members and API keys can access. Deny-by-default — add rules to grant access.
          These rules only apply to collaborators and API keys; the org owner always has full access.
        </p>
      </div>

      {error && <div className="wren-alert wren-alert--error">{error}</div>}

      {/* ── Create form ── */}
      <section className="wren-card" style={{ marginBottom: "1.5rem" }}>
        <h2 className="wren-section-title">Add Permission Rule</h2>
        <form onSubmit={handleCreate} style={{ display: "grid", gap: "0.75rem" }}>
          {/* Principal */}
          <div className="wren-field">
            <label className="wren-label">Principal</label>
            {principalOptions.length > 0 ? (
              <select
                className="wren-select"
                value={form.principal}
                onChange={e => setForm(f => ({ ...f, principal: e.target.value }))}
                required
              >
                <option value="">— select member or API key —</option>
                {principalOptions.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            ) : (
              <input
                className="wren-input"
                placeholder="member:<userId>  or  key:<keyId>"
                value={form.principal}
                onChange={e => setForm(f => ({ ...f, principal: e.target.value }))}
                required
              />
            )}
          </div>

          {/* Resource */}
          <div className="wren-field">
            <label className="wren-label">Resource</label>
            <input
              className="wren-input"
              placeholder={`e.g. collection:golf-magazine   or   ${resourceExamples.join("  ")}`}
              value={form.resource}
              onChange={e => setForm(f => ({ ...f, resource: e.target.value }))}
              required
            />
            <span className="wren-hint">
              Wildcards: <code>collection:*</code> all collections · <code>tree:*</code> all trees · <code>*</code> everything
            </span>
          </div>

          {/* Access level */}
          <div className="wren-field">
            <label className="wren-label">Access</label>
            <select
              className="wren-select"
              value={form.access}
              onChange={e => setForm(f => ({ ...f, access: e.target.value as PermissionCreate["access"] }))}
            >
              {ACCESS_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          {/* Label filter */}
          <div className="wren-field">
            <label className="wren-label">Label filter <span className="wren-hint">(optional)</span></label>
            <input
              className="wren-input"
              placeholder="e.g. live — reads scoped to this label silently"
              value={form.labelFilter ?? ""}
              onChange={e => setForm(f => ({ ...f, labelFilter: e.target.value || null }))}
            />
          </div>

          {/* Data filter */}
          <div className="wren-field">
            <label className="wren-label">Data filter <span className="wren-hint">(optional)</span></label>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
              <select
                className="wren-select"
                style={{ width: "140px", flexShrink: 0 }}
                value={form.filterLang ?? ""}
                onChange={e => setForm(f => ({ ...f, filterLang: (e.target.value || null) as PermissionCreate["filterLang"] }))}
              >
                <option value="">— none —</option>
                {FILTER_LANGS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              <input
                className="wren-input"
                placeholder="expression applied to document data"
                value={form.filterExpr ?? ""}
                onChange={e => setForm(f => ({ ...f, filterExpr: e.target.value || null }))}
                disabled={!form.filterLang}
              />
            </div>
          </div>

          {/* Audit */}
          <div className="wren-field">
            <label className="wren-label">Audit logging</label>
            <div style={{ display: "flex", gap: "1.5rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
                <input type="checkbox" checked={form.auditReads ?? false}
                  onChange={e => setForm(f => ({ ...f, auditReads: e.target.checked }))} />
                Log reads
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
                <input type="checkbox" checked={form.auditWrites ?? false}
                  onChange={e => setForm(f => ({ ...f, auditWrites: e.target.checked }))} />
                Log writes
              </label>
            </div>
          </div>

          {formError && <div className="wren-alert wren-alert--error">{formError}</div>}

          <div>
            <button type="submit" className="wren-btn wren-btn--primary" disabled={submitting}>
              {submitting ? "Adding…" : "Add rule"}
            </button>
          </div>
        </form>
      </section>

      {/* ── Rules table ── */}
      <section className="wren-card">
        <h2 className="wren-section-title">
          Rules
          <span className="wren-count">{permissions.length}</span>
        </h2>

        {permissions.length === 0 ? (
          <p className="wren-empty">No permission rules yet. Add one above.</p>
        ) : (
          <table className="wren-table">
            <thead>
              <tr>
                <th>Principal</th>
                <th>Resource</th>
                <th>Access</th>
                <th>Label filter</th>
                <th>Data filter</th>
                <th>Audit</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {permissions.map(p => {
                if (editId === p.id) {
                  return (
                    <tr key={p.id} style={{ background: "var(--wren-surface-2, #f8f8f8)" }}>
                      <td><code style={{ fontSize: "0.8rem" }}>{p.principal}</code></td>
                      <td><code style={{ fontSize: "0.8rem" }}>{p.resource}</code></td>
                      <td>
                        <select
                          className="wren-select"
                          value={editPatch.access ?? p.access}
                          onChange={e => setEditPatch(x => ({ ...x, access: e.target.value as Permission["access"] }))}
                        >
                          {ACCESS_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                      </td>
                      <td>
                        <input
                          className="wren-input"
                          value={(editPatch.labelFilter !== undefined ? editPatch.labelFilter : p.labelFilter) ?? ""}
                          onChange={e => setEditPatch(x => ({ ...x, labelFilter: e.target.value || null }))}
                        />
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "0.3rem" }}>
                          <select
                            className="wren-select"
                            value={(editPatch.filterLang !== undefined ? editPatch.filterLang : p.filterLang) ?? ""}
                            onChange={e => setEditPatch(x => ({ ...x, filterLang: (e.target.value || null) as Permission["filterLang"] }))}
                          >
                            <option value="">—</option>
                            {FILTER_LANGS.map(l => <option key={l} value={l}>{l}</option>)}
                          </select>
                          <input
                            className="wren-input"
                            value={(editPatch.filterExpr !== undefined ? editPatch.filterExpr : p.filterExpr) ?? ""}
                            onChange={e => setEditPatch(x => ({ ...x, filterExpr: e.target.value || null }))}
                          />
                        </div>
                      </td>
                      <td>
                        <label style={{ display: "flex", flexDirection: "column", gap: "0.2rem", fontSize: "0.8rem" }}>
                          <label>
                            <input type="checkbox"
                              checked={(editPatch.auditReads !== undefined ? editPatch.auditReads : p.auditReads)}
                              onChange={e => setEditPatch(x => ({ ...x, auditReads: e.target.checked }))} />
                            {" "}reads
                          </label>
                          <label>
                            <input type="checkbox"
                              checked={(editPatch.auditWrites !== undefined ? editPatch.auditWrites : p.auditWrites)}
                              onChange={e => setEditPatch(x => ({ ...x, auditWrites: e.target.checked }))} />
                            {" "}writes
                          </label>
                        </label>
                      </td>
                      <td style={{ display: "flex", gap: "0.4rem" }}>
                        <button className="wren-btn wren-btn--primary wren-btn--sm"
                          onClick={() => handleSaveEdit(p.id)}>Save</button>
                        <button className="wren-btn wren-btn--sm"
                          onClick={() => { setEditId(null); setEditPatch({}); }}>Cancel</button>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={p.id}>
                    <td><code style={{ fontSize: "0.8rem" }}>{p.principal}</code></td>
                    <td><code style={{ fontSize: "0.8rem" }}>{p.resource}</code></td>
                    <td>{accessBadge(p.access)}</td>
                    <td>{p.labelFilter ? <code style={{ fontSize: "0.8rem" }}>{p.labelFilter}</code> : <span className="wren-muted">—</span>}</td>
                    <td>
                      {p.filterExpr
                        ? <><span className="wren-badge wren-badge--neutral">{p.filterLang}</span>{" "}<code style={{ fontSize: "0.75rem" }}>{p.filterExpr}</code></>
                        : <span className="wren-muted">—</span>}
                    </td>
                    <td style={{ fontSize: "0.8rem" }}>
                      {[p.auditReads ? "reads" : "", p.auditWrites ? "writes" : ""].filter(Boolean).join(", ") || <span className="wren-muted">—</span>}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "0.4rem" }}>
                        <button
                          className="wren-btn wren-btn--sm"
                          onClick={() => { setEditId(p.id); setEditPatch({}); }}
                        >
                          Edit
                        </button>
                        <ConfirmButton
                          label="Delete"
                          confirmLabel="Confirm"
                          className="wren-btn wren-btn--sm wren-btn--danger"
                          onConfirm={() => handleDelete(p.id)}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
