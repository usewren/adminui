import React, { useEffect, useRef, useState } from "react";
import { Button, Card, Badge, Spinner } from "componentlibrary";
import { ConfirmButton } from "../ConfirmButton";
import {
  listApiKeys, createApiKey, revokeApiKey,
  type ApiKey, type ApiKeyCreated,
} from "../api";

export function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<ApiKeyCreated | null>(null);
  const [copied, setCopied] = useState(false);
  const keyInputRef = useRef<HTMLInputElement>(null);

  function load() {
    setLoading(true);
    listApiKeys()
      .then(setKeys)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setError(null);
    try {
      const k = await createApiKey(name);
      setCreated(k);
      setNewName("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create key");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    await revokeApiKey(id);
    load();
  }

  function handleCopy() {
    if (!created) return;
    navigator.clipboard.writeText(created.key).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const activeKeys = keys.filter(k => !k.revokedAt);
  const revokedKeys = keys.filter(k => k.revokedAt);

  return (
    <div>
      <div className="admin-main__header">
        <h1 className="admin-page-title">API Keys</h1>
      </div>

      {/* One-time key reveal */}
      {created && (
        <Card title="Key created — copy it now">
          <p style={{ fontSize: 13, color: "var(--wren-text-muted)", marginBottom: 12 }}>
            This is the only time your key will be shown. Store it somewhere safe.
          </p>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              ref={keyInputRef}
              readOnly
              value={created.key}
              onClick={() => keyInputRef.current?.select()}
              style={{
                flex: 1, fontFamily: "var(--wren-mono)", fontSize: 13,
                background: "var(--wren-bg-subtle)", border: "1px solid var(--wren-border)",
                borderRadius: 6, padding: "8px 10px", color: "var(--wren-text)",
              }}
            />
            <Button variant="primary" size="sm" onClick={handleCopy}>
              {copied ? "Copied!" : "Copy"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setCreated(null)}>
              Dismiss
            </Button>
          </div>
        </Card>
      )}

      {/* Create form */}
      <Card title="Create a new API key">
        <p style={{ fontSize: 13, color: "var(--wren-text-muted)", marginBottom: 14 }}>
          API keys authenticate server-to-server requests using{" "}
          <code style={{ fontFamily: "var(--wren-mono)", fontSize: 12 }}>Authorization: Bearer &lt;key&gt;</code>.
          Keys have the same access as your account.
        </p>
        {error && <div className="admin-error" style={{ marginBottom: 10 }}>{error}</div>}
        <form onSubmit={handleCreate} style={{ display: "flex", gap: 8 }}>
          <input
            className="wren-input"
            placeholder="Key name, e.g. marketing-site"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={{ flex: 1 }}
          />
          <Button type="submit" variant="primary" size="sm" loading={creating}>
            Create key
          </Button>
        </form>
      </Card>

      {/* Active keys */}
      <Card title={`Active keys (${activeKeys.length})`}>
        {loading ? (
          <div className="admin-spinner-center"><Spinner size="lg" /></div>
        ) : activeKeys.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--wren-text-muted)" }}>No active keys.</p>
        ) : (
          <table className="wren-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Prefix</th>
                <th>Created</th>
                <th>Last used</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {activeKeys.map((k) => (
                <tr key={k.id}>
                  <td style={{ fontWeight: 500 }}>{k.name}</td>
                  <td>
                    <code style={{ fontFamily: "var(--wren-mono)", fontSize: 12 }}>{k.keyPrefix}…</code>
                  </td>
                  <td style={{ fontSize: 12, color: "var(--wren-text-muted)" }}>
                    {new Date(k.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ fontSize: 12, color: "var(--wren-text-muted)" }}>
                    {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : "Never"}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <ConfirmButton
                      label="Revoke"
                      confirmLabel="Yes, revoke"
                      prompt={`Revoke key "${k.name}"? Any services using it will stop working.`}
                      variant="danger"
                      onConfirm={() => handleRevoke(k.id)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Revoked keys (collapsed) */}
      {revokedKeys.length > 0 && (
        <Card title={`Revoked keys (${revokedKeys.length})`}>
          <table className="wren-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Prefix</th>
                <th>Revoked</th>
              </tr>
            </thead>
            <tbody>
              {revokedKeys.map((k) => (
                <tr key={k.id} style={{ opacity: 0.5 }}>
                  <td>{k.name}</td>
                  <td>
                    <code style={{ fontFamily: "var(--wren-mono)", fontSize: 12 }}>{k.keyPrefix}…</code>
                  </td>
                  <td style={{ fontSize: 12 }}>
                    <Badge label="revoked" variant="red" />
                    {" "}{k.revokedAt ? new Date(k.revokedAt).toLocaleDateString() : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
