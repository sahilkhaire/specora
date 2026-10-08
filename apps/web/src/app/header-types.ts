export type ThemeMode = "light" | "dark" | "system";

export interface WorkbenchHeaderConfig {
  historyOpen: boolean;
  onToggleHistory: () => void;
  schemaPanelOpen: boolean;
  onToggleSchemaPanel: () => void;
  onExportPostman: () => void;
  onOpenApiOverview: () => void;
  /** Absent where workflows are unavailable (SDK embed / published docs). */
  onOpenWorkflows?: () => void;
}
