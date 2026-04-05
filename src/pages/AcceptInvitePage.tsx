import React, { useEffect, useState } from "react";
import { acceptInvite, ApiError } from "../api";

interface AcceptInvitePageProps {
  token: string;
}

type State =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "accepted"; orgId: string }
  | { phase: "error"; message: string };

export function AcceptInvitePage({ token }: AcceptInvitePageProps) {
  const [state, setState] = useState<State>({ phase: "idle" });

  async function handleAccept() {
    setState({ phase: "loading" });
    try {
      const result = await acceptInvite(token);
      setState({ phase: "accepted", orgId: result.orgId });
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Something went wrong. Please try again.";
      setState({ phase: "error", message });
    }
  }

  // If already accepted, redirect to collections after a moment
  useEffect(() => {
    if (state.phase === "accepted") {
      const t = setTimeout(() => { window.location.hash = "#/"; }, 2500);
      return () => clearTimeout(t);
    }
  }, [state.phase]);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "60vh",
      padding: 32,
    }}>
      <div style={{
        maxWidth: 420,
        width: "100%",
        padding: "32px 28px",
        background: "var(--wren-surface-raised)",
        border: "1px solid var(--wren-border)",
        borderRadius: 12,
        textAlign: "center",
      }}>
        <img
          src="/wren-logo.svg"
          alt="Wren"
          style={{ width: 48, height: 48, borderRadius: 10, marginBottom: 16 }}
        />
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
          You've been invited
        </h1>

        {state.phase === "idle" && (
          <>
            <p style={{ color: "var(--wren-text-muted)", fontSize: 14, marginBottom: 24 }}>
              Accept this invite to join as a collaborator and get access to the shared workspace.
            </p>
            <button
              className="wren-btn wren-btn--primary"
              style={{ width: "100%" }}
              onClick={handleAccept}
            >
              Accept invite
            </button>
          </>
        )}

        {state.phase === "loading" && (
          <p style={{ color: "var(--wren-text-muted)", fontSize: 14 }}>Accepting invite…</p>
        )}

        {state.phase === "accepted" && (
          <>
            <p style={{ color: "var(--wren-success, #22c55e)", fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
              Invite accepted!
            </p>
            <p style={{ color: "var(--wren-text-muted)", fontSize: 13 }}>
              You now have access to the shared workspace. Redirecting…
            </p>
          </>
        )}

        {state.phase === "error" && (
          <>
            <p style={{ color: "var(--wren-danger)", fontSize: 14, marginBottom: 20 }}>
              {state.message}
            </p>
            <button
              className="wren-btn wren-btn--ghost"
              onClick={() => setState({ phase: "idle" })}
            >
              Try again
            </button>
          </>
        )}
      </div>
    </div>
  );
}
