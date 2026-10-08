import { createContext, useContext } from "react";

export type ShellPane = "sidebar" | "main" | "docs";

export interface ShellNav {
  /** On narrow screens, switch to a pane (e.g. the request editor after picking a request). No-op on desktop. */
  showPane: (pane: ShellPane) => void;
}

export const ShellNavContext = createContext<ShellNav>({ showPane: () => undefined });

export function useShellNav(): ShellNav {
  return useContext(ShellNavContext);
}
