"use client";

import * as React from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  loading?: boolean;
};

function variantClasses(variant: ButtonVariant): string {
  switch (variant) {
    case "secondary":
      return "border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-2)]";
    case "ghost":
      return "border border-transparent bg-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]";
    case "primary":
    default:
      return "border border-[var(--accent)] bg-[var(--accent)] text-white hover:opacity-90";
  }
}

export function Button({
  className = "",
  variant = "primary",
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`inline-flex h-11 items-center justify-center gap-2 px-4 font-mono text-[10px] uppercase tracking-widest transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60 ${variantClasses(variant)} ${className}`}
    >
      {loading ? (
        <span
          aria-hidden
          className="inline-block h-3 w-3 animate-spin border border-current border-t-transparent"
        />
      ) : null}
      <span>{children}</span>
    </button>
  );
}
