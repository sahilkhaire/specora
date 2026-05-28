import type { ReactNode } from "react";

export function Badge({
  children,
  tone = "default",
  className = ""
}: {
  children: ReactNode;
  tone?: "default" | "success" | "warning" | "error" | "version";
  className?: string;
}) {
  return <span className={`ui-badge ui-badge-${tone} ${className}`.trim()}>{children}</span>;
}
