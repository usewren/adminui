import React, { useState } from "react";
import { Button } from "componentlibrary";

interface ConfirmButtonProps {
  label: string;
  confirmLabel?: string;
  prompt?: string;
  variant?: "danger" | "secondary" | "ghost";
  size?: "sm" | "md";
  loading?: boolean;
  disabled?: boolean;
  onConfirm: () => void;
}

export function ConfirmButton({
  label,
  confirmLabel = "Confirm",
  prompt = "Are you sure?",
  variant = "danger",
  size = "sm",
  loading = false,
  disabled = false,
  onConfirm,
}: ConfirmButtonProps) {
  const [pending, setPending] = useState(false);

  if (!pending) {
    return (
      <Button
        variant={variant}
        size={size}
        loading={loading}
        disabled={disabled}
        onClick={() => setPending(true)}
      >
        {label}
      </Button>
    );
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <span style={{ fontSize: 13, color: "var(--wren-text-muted)", whiteSpace: "nowrap" }}>
        {prompt}
      </span>
      <Button
        variant={variant}
        size={size}
        loading={loading}
        onClick={() => { setPending(false); onConfirm(); }}
      >
        {confirmLabel}
      </Button>
      <Button variant="ghost" size={size} onClick={() => setPending(false)}>
        Cancel
      </Button>
    </span>
  );
}
