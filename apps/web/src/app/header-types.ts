export type ThemeMode = "light" | "dark" | "system";

export interface WorkbenchHeaderConfig {
  historyOpen: boolean;
  onToggleHistory: () => void;
  onExportPostman: () => void;
}
