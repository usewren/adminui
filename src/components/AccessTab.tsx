/**
 * AccessTab — reusable access-control panel for a specific resource
 * (e.g. "collection:golf-magazine" or "tree:site").
 *
 * Shows rules scoped to that resource plus a read-only "inherited" section
 * for broader wildcard rules that also apply.
 */
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

function principalLabel(principal: string, members: Member[], keys: ApiKey[]): string {
  if (principal.startsWith("member:")) {
    const uid = principal.slice(7);
    const m = members.find(m => m.userId === uid);
    return m ? `${m.name} <${m.email}>` : principal;
  }
  if (principal.startsWith("key:")) {
    const kid = principal.slice(4);
    const k = keys.find(k => k.id === kid);
    return k ? `key: ${k.name} (${k.keyPrefix}…)` : principal;
  }
  return principal;
}

interface AccessTabProps {
  /** The full resource string, e.g. "collection:golf-magazine" */
  resource: string;
  /** "collection" | "tree" — used to determine which wildcard rules to show */
  resourceType: "collection" | "tree";
}

export function AccessTab({ resource, resourceType }: AccessTabProps) {
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add-rule form
  const [principal, setPrincipal] = useState("");
  const [access, setAccess] = useState<PermissionCreate["access"]>("read");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [labelFilter, setLabelFilter] = useState("");
  const [filterLang, setFilterLang] = useState<PermissionCreate["filterLang"]>(null);
  const [filterExpr, setFilterExpr] = useState("");
  const [auditReads, setAuditReads] = useState(false);
  const [auditWrites, setAuditWrites] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editAccess, setEditAccess] = useState<Permission["access"]>("read");
  const [editLabelFilter, setEditLabelFilter] = useState("");
  const [editFilterLang, setEditFilterLang] = useState<Permission["filterLang"]>(null);
  const [editFilterExpr, setEditFilterExpr] = useState("");
  const [editAuditReads, setEditAuditReads] = useState(false);
  const [editAuditWrites, setEditAuditWrites] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [perms, mems, ks] = await Promise.all([
        listPermissions(),
        listMembers().catch(() => [] as Member[]),
        listApiKeys().catch(() => [] as ApiKey[]),
      ]);
      setAllPermissions(perms);
      setMembers(mems);
      setKeys(ks.filter(k => !k.revokedAt));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [resource]);

  // Split into rules directly for this resource vs. broader inherited rules
  const directRules = allPermissions.filter(p => p.resource === resource);
  const inheritedRules = allPermissions.filter(p =>
    p.resource === `${resourceType}:*` || p.resource === "*"
  );

  function openEdit(p: Permission) {
    setEditId(p.id);
    setEditAccess(p.access);
    setEditLabelFilter(p.labelFilter ?? "");
    setEditFilterLang(p.filterLang);
    setEditFilterExpr(p.filterExpr ?? "");
    setEditAuditReads(p.auditReads);
    setEditAuditWrites(p.auditWrites);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const created = await createPermission({
        principal,
        resource,
        access,
        labelFilter: labelFilter || null,
        filterLang: filterLang || null,
        filterExpr: filterExpr || null,
        auditReads,
        auditWrites,
      });
      setAllPermissions(prev => [created, ...prev]);
      setPrincipal(""); setAccess("read");
      setLabelFilter(""); setFilterLang(null); setFilterExpr("");
      setAuditReads(false); setAuditWrites(false);
      setShowAdvanced(false);
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Failed to add rule");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveEdit() {
    if (!editId) return;
    const updated = await updatePermission(editId, {
      access: editAccess,
      labelFilter: editLabelFilter || null,
      filterLang: editFilterLang || null,
      filterExpr: editFilterExpr || null,
      auditReads: editAuditReads,
      auditWrites: editAuditWrites,
    });
    setAllPermissions(prev => prev.map(p => p.id === editId ? updated : p));
    setEditId(null);
  }

  async function handleDelete(id: string) {
    await deletePermission(id);
    setAllPermissions(prev => prev.filter(p => p.id !== id));
    if (editId === id) setEditId(null);
  }

  const principalOptions = [
    ...members.map(m => ({ value: `member:${m.userId}`, label: `${m.name} <${m.email}>` })),
    ...keys.map(k =>   ({ value: `key:${k.id}`,          label: `API key: ${k.name} (${k.keyPrefix}…)` })),
  ];

  if (loading) return <div className="admin-spinner-center" style={{ padding: "2rem" }}>Loading…</div>;
  if (error)   return <div className="admin-error">{error}</div>;

  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>

      {/* ── Grant access form ── */}
      <div className="wren-card">
        <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.9rem", fontWeight: 600 }}>
          Grant access to <code style={{ fontSize: "0.85rem" }}>{resource}</code>
        </h3>
        <form onSubmit={handleCreate}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "0.5rem", alignItems: "end" }}>
            <div className="wren-field" style={{ margin: 0 }}>
              <label className="wren-label">Who</label>
              {principalOptions.length > 0 ? (
                <select className="wren-select" value={principal}
                  onChange={e => setPrincipal(e.target.value)} required>
                  <option value="">— select member or API key —</option>
                  {principalOptions.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <input className="wren-input" placeholder="member:<userId>  or  key:<keyId>"
                  value={principal} onChange={e => setPrincipal(e.target.value)} required />
              )}
            </div>

            <div className="wren-field" style={{ margin: 0 }}>
              <label className="wren-label">Access</label>
              <select className="wren-select" value={access}
                onChange={e => setAccess(e.target.value as PermissionCreate["access"])}>
                {ACCESS_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            <button type="submit" className="wren-btn wren-btn--primary"
              style={{ alignSelf: "end" }} disabled={submitting}>
              {submitting ? "Granting…" : "Grant"}
            </button>
          </div>

          <div style={{ marginTop: "0.5rem" }}>
            <button type="button" className="wren-btn wren-btn--ghost wren-btn--sm"
              onClick={() => setShowAdvanced(v => !v)}>
              {showAdvanced ? "▲ Hide" : "▼ Advanced"} (label filter, data filter, audit)
            </button>
          </div>

          {showAdvanced && (
            <div style={{ marginTop: "0.65rem", paddingTop: "0.65rem", borderTop: "1px solid var(--wren-border)", display: "grid", gap: "0.5rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                <div className="wren-field" style={{ margin: 0 }}>
                  <label className="wren-label">Label filter <span className="wren-hint">— scope reads to this label</span></label>
                  <input className="wren-input" placeholder="e.g. live"
                    value={labelFilter} onChange={e => setLabelFilter(e.target.value)} />
                </div>
                <div className="wren-field" style={{ margin: 0 }}>
                  <label className="wren-label">Data filter</label>
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    <select className="wren-select" style={{ width: "130px", flexShrink: 0 }}
                      value={filterLang ?? ""}
                      onChange={e => setFilterLang((e.target.value || null) as PermissionCreate["filterLang"])}>
                      <option value="">— none —</option>
                      {FILTER_LANGS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                    <input className="wren-input" placeholder="expression"
                      value={filterExpr} disabled={!filterLang}
                      onChange={e => setFilterExpr(e.target.value)} />
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "1.5rem" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", fontSize: "0.875rem" }}>
                  <input type="checkbox" checked={auditReads} onChange={e => setAuditReads(e.target.checked)} />
                  Log reads
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", fontSize: "0.875rem" }}>
                  <input type="checkbox" checked={auditWrites} onChange={e => setAuditWrites(e.target.checked)} />
                  Log writes
                </label>
              </div>
            </div>
          )}

          {formError && <div className="admin-error" style={{ marginTop: "0.5rem" }}>{formError}</div>}
        </form>
      </div>

      {/* ── Direct rules ── */}
      <div className="wren-card">
        <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.9rem", fontWeight: 600 }}>
          Rules for this {resourceType}
          {directRules.length > 0 && (
            <span className="wren-count" style={{ marginLeft: "0.4rem" }}>{directRules.length}</span>
          )}
        </h3>

        {directRules.length === 0 ? (
          <p style={{ fontSize: "0.875rem", color: "var(--wren-text-muted)", margin: 0 }}>
            No rules yet — access is denied by default.
          </p>
        ) : (
          <table className="wren-table">
            <thead>
              <tr>
                <th>Who</th>
                <th>Access</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {directRules.map(p => (
                <React.Fragment key={p.id}>
                  <tr>
                    <td style={{ fontSize: "0.875rem" }}>{principalLabel(p.principal, members, keys)}</td>
                    <td>{accessBadge(p.access)}</td>
                    <td style={{ fontSize: "0.8rem", color: "var(--wren-text-muted)" }}>
                      {[
                        p.labelFilter ? `label:${p.labelFilter}` : "",
                        p.filterExpr  ? `${p.filterLang}: ${p.filterExpr}` : "",
                        p.auditReads  ? "audit reads" : "",
                        p.auditWrites ? "audit writes" : "",
                      ].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "0.4rem" }}>
                        <button className="wren-btn wren-btn--sm"
                          onClick={() => editId === p.id ? setEditId(null) : openEdit(p)}>
                          {editId === p.id ? "Close" : "Edit"}
                        </button>
                        <ConfirmButton
                          label="Remove"
                          confirmLabel="Confirm"
                          className="wren-btn wren-btn--sm wren-btn--danger"
                          onConfirm={() => handleDelete(p.id)}
                        />
                      </div>
                    </td>
                  </tr>

                  {editId === p.id && (
                    <tr>
                      <td colSpan={4} style={{ padding: "0.75rem 1rem", background: "var(--wren-surface-2, #f9f9f9)" }}>
                        <div style={{ display: "grid", gap: "0.5rem" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr", gap: "0.5rem", alignItems: "end" }}>
                            <div className="wren-field" style={{ margin: 0 }}>
                              <label className="wren-label">Access</label>
                              <select className="wren-select" value={editAccess}
                                onChange={e => setEditAccess(e.target.value as Permission["access"])}>
                                {ACCESS_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                              </select>
                            </div>
                            <div className="wren-field" style={{ margin: 0 }}>
                              <label className="wren-label">Label filter</label>
                              <input className="wren-input" placeholder="e.g. live"
                                value={editLabelFilter} onChange={e => setEditLabelFilter(e.target.value)} />
                            </div>
                            <div className="wren-field" style={{ margin: 0 }}>
                              <label className="wren-label">Data filter</label>
                              <div style={{ display: "flex", gap: "0.4rem" }}>
                                <select className="wren-select" style={{ width: "120px", flexShrink: 0 }}
                                  value={editFilterLang ?? ""}
                                  onChange={e => setEditFilterLang((e.target.value || null) as Permission["filterLang"])}>
                                  <option value="">—</option>
                                  {FILTER_LANGS.map(l => <option key={l} value={l}>{l}</option>)}
                                </select>
                                <input className="wren-input" placeholder="expression"
                                  value={editFilterExpr} disabled={!editFilterLang}
                                  onChange={e => setEditFilterExpr(e.target.value)} />
                              </div>
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
                            <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", fontSize: "0.875rem" }}>
                              <input type="checkbox" checked={editAuditReads} onChange={e => setEditAuditReads(e.target.checked)} />
                              Log reads
                            </label>
                            <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", fontSize: "0.875rem" }}>
                              <input type="checkbox" checked={editAuditWrites} onChange={e => setEditAuditWrites(e.target.checked)} />
                              Log writes
                            </label>
                            <button className="wren-btn wren-btn--primary wren-btn--sm" onClick={handleSaveEdit}>Save</button>
                            <button className="wren-btn wren-btn--sm" onClick={() => setEditId(null)}>Cancel</button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Inherited / wildcard rules ── */}
      {inheritedRules.length > 0 && (
        <div className="wren-card">
          <h3 style={{ margin: "0 0 0.4rem", fontSize: "0.9rem", fontWeight: 600 }}>
            Also applies (inherited rules)
          </h3>
          <p style={{ fontSize: "0.8rem", color: "var(--wren-text-muted)", margin: "0 0 0.75rem" }}>
            These broader rules also govern access. Manage them on the{" "}
            <a href="#/settings/permissions" style={{ color: "var(--wren-accent)" }}>Permissions page</a>.
          </p>
          <table className="wren-table">
            <thead>
              <tr>
                <th>Who</th>
                <th>Resource</th>
                <th>Access</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {inheritedRules.map(p => (
                <tr key={p.id} style={{ opacity: 0.75 }}>
                  <td style={{ fontSize: "0.875rem" }}>{principalLabel(p.principal, members, keys)}</td>
                  <td><code style={{ fontSize: "0.8rem" }}>{p.resource}</code></td>
                  <td>{accessBadge(p.access)}</td>
                  <td style={{ fontSize: "0.8rem", color: "var(--wren-text-muted)" }}>
                    {[
                      p.labelFilter ? `label:${p.labelFilter}` : "",
                      p.filterExpr  ? `${p.filterLang}: ${p.filterExpr}` : "",
                    ].filter(Boolean).join(" · ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
