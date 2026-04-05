import React, { useEffect, useState } from "react";
import {
  listInvites, createInvite, revokeInvite,
  listReceivedInvites, acceptInviteById,
  listMembers, removeMember,
  type Invite, type InviteCreated, type ReceivedInvite, type Member,
  getApiUrl, ApiError,
} from "../api";
import { ConfirmButton } from "../ConfirmButton";

function statusBadge(invite: Invite): React.ReactElement {
  if (invite.revokedAt)
    return <span className="wren-badge wren-badge--neutral">revoked</span>;
  if (invite.acceptedAt)
    return <span className="wren-badge wren-badge--success">accepted</span>;
  if (new Date(invite.expiresAt) < new Date())
    return <span className="wren-badge wren-badge--warning">expired</span>;
  return <span className="wren-badge wren-badge--info">pending</span>;
}

export function CollaboratorsPage() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [received, setReceived] = useState<ReceivedInvite[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [newInvite, setNewInvite] = useState<InviteCreated | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    try {
      const [inv, recv, mem] = await Promise.all([listInvites(), listReceivedInvites(), listMembers()]);
      setInvites(inv);
      setReceived(recv);
      setMembers(mem);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    const addr = email.trim().toLowerCase();
    if (!addr) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await createInvite(addr);
      setNewInvite(created);
      setEmail("");
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send invite");
    } finally {
      setSubmitting(false);
    }
  }

  function inviteLink(token: string): string {
    return `${getApiUrl()}/admin#/invites/accept?token=${token}`;
  }

  async function copyLink(token: string) {
    await navigator.clipboard.writeText(inviteLink(token));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleRevoke(id: string) {
    await revokeInvite(id);
    reload();
  }

  async function handleRemove(userId: string) {
    await removeMember(userId);
    reload();
  }

  async function handleAcceptById(inviteId: string) {
    setAccepting(inviteId);
    try {
      await acceptInviteById(inviteId);
      window.location.reload(); // reload page so org switcher reflects new membership
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to accept invite");
      setAccepting(null);
    }
  }

  const pendingInvites = invites.filter(i => !i.revokedAt && !i.acceptedAt && new Date(i.expiresAt) >= new Date());
  const pastInvites   = invites.filter(i =>  i.revokedAt ||  i.acceptedAt || new Date(i.expiresAt) <  new Date());

  return (
    <div style={{ maxWidth: 700, padding: "32px 24px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Collaborators</h1>
      <p style={{ color: "var(--wren-text-muted)", marginBottom: 32 }}>
        Invite team members to share your workspace. Collaborators have full read/write access.
      </p>

      {/* Received invites */}
      {received.filter(i => !i.acceptedAt && !i.revokedAt && new Date(i.expiresAt) >= new Date()).length > 0 && (
        <section style={{
          marginBottom: 32,
          padding: "16px 20px",
          background: "var(--wren-surface-raised)",
          border: "1px solid var(--wren-border)",
          borderRadius: 10,
        }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
            Pending invitations for you
          </h2>
          {received
            .filter(i => !i.acceptedAt && !i.revokedAt && new Date(i.expiresAt) >= new Date())
            .map(i => (
              <div key={i.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "8px 0", borderTop: "1px solid var(--wren-border)" }}>
                <div>
                  <span style={{ fontWeight: 500 }}>{i.orgName}</span>
                  <span style={{ color: "var(--wren-text-muted)", fontSize: 13 }}> ({i.orgEmail})</span>
                  <span style={{ marginLeft: 8 }}><span className="wren-badge wren-badge--neutral">{i.role}</span></span>
                  <div style={{ fontSize: 12, color: "var(--wren-text-muted)", marginTop: 2 }}>
                    Expires {new Date(i.expiresAt).toLocaleDateString()}
                  </div>
                </div>
                <button
                  className="wren-btn wren-btn--primary wren-btn--sm"
                  disabled={accepting === i.id}
                  onClick={() => handleAcceptById(i.id)}
                >
                  {accepting === i.id ? "Accepting…" : "Accept"}
                </button>
              </div>
            ))}
        </section>
      )}

      {/* Invite form */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Send invite</h2>
        <form onSubmit={handleInvite} style={{ display: "flex", gap: 8, maxWidth: 440 }}>
          <input
            className="wren-input"
            type="email"
            placeholder="colleague@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            disabled={submitting}
            style={{ flex: 1 }}
          />
          <button
            className="wren-btn wren-btn--primary"
            type="submit"
            disabled={submitting || !email.trim()}
          >
            {submitting ? "Sending…" : "Invite"}
          </button>
        </form>
        {error && (
          <p style={{ color: "var(--wren-danger)", fontSize: 13, marginTop: 8 }}>{error}</p>
        )}

        {/* One-time invite link card */}
        {newInvite && (
          <div style={{
            marginTop: 16,
            padding: "14px 16px",
            background: "var(--wren-surface-raised)",
            border: "1px solid var(--wren-border)",
            borderRadius: 8,
            maxWidth: 520,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              Invite link for {newInvite.email}
            </div>
            <div style={{
              fontFamily: "monospace",
              fontSize: 11,
              background: "var(--wren-surface)",
              padding: "6px 10px",
              borderRadius: 5,
              wordBreak: "break-all",
              marginBottom: 10,
              color: "var(--wren-text-muted)",
            }}>
              {inviteLink(newInvite.token)}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                className="wren-btn wren-btn--primary wren-btn--sm"
                onClick={() => copyLink(newInvite.token)}
              >
                {copied ? "Copied!" : "Copy link"}
              </button>
              <button
                className="wren-btn wren-btn--ghost wren-btn--sm"
                onClick={() => setNewInvite(null)}
              >
                Dismiss
              </button>
              <span style={{ fontSize: 12, color: "var(--wren-text-muted)" }}>
                Expires {new Date(newInvite.expiresAt).toLocaleDateString()}
              </span>
            </div>
            <p style={{ fontSize: 12, color: "var(--wren-text-muted)", marginTop: 8, marginBottom: 0 }}>
              This link is shown once. Share it directly with your collaborator.
            </p>
          </div>
        )}
      </section>

      {loading ? (
        <div style={{ color: "var(--wren-text-muted)" }}>Loading…</div>
      ) : (
        <>
          {/* Current members */}
          {members.length > 0 && (
            <section style={{ marginBottom: 40 }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
                Members ({members.length})
              </h2>
              <table className="wren-table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Joined</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {members.map(m => (
                    <tr key={m.userId}>
                      <td>{m.name}</td>
                      <td style={{ color: "var(--wren-text-muted)" }}>{m.email}</td>
                      <td><span className="wren-badge wren-badge--neutral">{m.role}</span></td>
                      <td style={{ color: "var(--wren-text-muted)", fontSize: 13 }}>
                        {new Date(m.joinedAt).toLocaleDateString()}
                      </td>
                      <td>
                        <ConfirmButton
                          label="Remove"
                          confirmLabel="Confirm"
                          className="wren-btn wren-btn--ghost wren-btn--sm"
                          onConfirm={() => handleRemove(m.userId)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {/* Pending invites */}
          {pendingInvites.length > 0 && (
            <section style={{ marginBottom: 40 }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
                Pending invites ({pendingInvites.length})
              </h2>
              <table className="wren-table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Expires</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pendingInvites.map(i => (
                    <tr key={i.id}>
                      <td>{i.email}</td>
                      <td><span className="wren-badge wren-badge--neutral">{i.role}</span></td>
                      <td style={{ color: "var(--wren-text-muted)", fontSize: 13 }}>
                        {new Date(i.expiresAt).toLocaleDateString()}
                      </td>
                      <td>
                        <ConfirmButton
                          label="Revoke"
                          confirmLabel="Confirm"
                          className="wren-btn wren-btn--ghost wren-btn--sm"
                          onConfirm={() => handleRevoke(i.id)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {/* Past invites */}
          {pastInvites.length > 0 && (
            <section>
              <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: "var(--wren-text-muted)" }}>
                Past invites
              </h2>
              <table className="wren-table" style={{ width: "100%", opacity: 0.6 }}>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {pastInvites.map(i => (
                    <tr key={i.id}>
                      <td>{i.email}</td>
                      <td><span className="wren-badge wren-badge--neutral">{i.role}</span></td>
                      <td>{statusBadge(i)}</td>
                      <td style={{ fontSize: 13, color: "var(--wren-text-muted)" }}>
                        {new Date(i.acceptedAt ?? i.revokedAt ?? i.expiresAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {members.length === 0 && invites.length === 0 && (
            <div style={{ color: "var(--wren-text-muted)", fontSize: 14 }}>
              No collaborators yet. Send an invite above to get started.
            </div>
          )}
        </>
      )}
    </div>
  );
}
