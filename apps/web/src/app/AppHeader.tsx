import type { ReactNode } from "react";
import { isFullAppSurface } from "@/config/deployment";
import { WorkspaceSelector } from "@/features/workspaces/WorkspaceSelector";
import type { Workspace } from "@/features/workspaces/workspace-types";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";

type ThemeMode = "light" | "dark" | "system";

interface AppHeaderProps {
  apiTitle: string;
  apiVersion: string;
  specVersionLabel?: string;
  hasSpec: boolean;
  workspaces: Workspace[];
  activeWorkspaceId: string;
  onSwitchWorkspace: (id: string) => void;
  onCreateWorkspace: (name: string, description?: string) => void;
  onRenameWorkspace: (id: string, name: string) => void;
  onDeleteWorkspace: (id: string) => void;
  activeEnvName?: string;
  onOpenEnvironment: () => void;
  onImportSpec?: () => void;
  onOpenSettings: () => void;
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
  showImportSpec: boolean;
  extraActions?: ReactNode;
}

function themeLabel(mode: ThemeMode): string {
  if (mode === "system") return "Theme: Auto";
  if (mode === "dark") return "Theme: Dark";
  return "Theme: Light";
}

function cycleTheme(mode: ThemeMode): ThemeMode {
  if (mode === "light") return "dark";
  if (mode === "dark") return "system";
  return "light";
}

export function AppHeader({
  apiTitle,
  apiVersion,
  specVersionLabel,
  hasSpec,
  workspaces,
  activeWorkspaceId,
  onSwitchWorkspace,
  onCreateWorkspace,
  onRenameWorkspace,
  onDeleteWorkspace,
  activeEnvName,
  onOpenEnvironment,
  onImportSpec,
  onOpenSettings,
  themeMode,
  onThemeModeChange,
  showImportSpec,
  extraActions
}: AppHeaderProps) {
  const showWorkspace = isFullAppSurface();

  return (
    <header className="app-top-header" aria-label="Application header">
      <div className="app-top-header-brand">
        <span className="app-top-header-logo" aria-hidden="true">
          S
        </span>
        <div className="app-top-header-brand-text">
          <span className="app-top-header-product">Specora</span>
          <span className="app-top-header-tagline">API client</span>
        </div>
      </div>

      {showWorkspace ? (
        <div className="app-top-header-workspace">
          <WorkspaceSelector
            workspaces={workspaces}
            activeWorkspaceId={activeWorkspaceId}
            onSwitch={onSwitchWorkspace}
            onCreate={onCreateWorkspace}
            onRename={onRenameWorkspace}
            onDelete={onDeleteWorkspace}
          />
        </div>
      ) : null}

      {hasSpec ? (
        <div className="app-top-header-api-meta">
          <span className="app-top-header-api-title" title={apiTitle}>
            {apiTitle}
          </span>
          <span className="app-top-header-api-version">v{apiVersion}</span>
          {specVersionLabel ? <Badge tone="version">{specVersionLabel}</Badge> : null}
        </div>
      ) : (
        <div className="app-top-header-api-meta app-top-header-api-meta--empty">
          <span className="app-top-header-api-placeholder">No API loaded</span>
        </div>
      )}

      <div className="app-top-header-actions">
        {activeEnvName ? (
          <button type="button" className="app-top-header-env-chip" onClick={onOpenEnvironment}>
            <span className="app-top-header-env-label">Env</span>
            <span className="app-top-header-env-name">{activeEnvName}</span>
          </button>
        ) : (
          <Button variant="ghost" onClick={onOpenEnvironment}>
            Environment
          </Button>
        )}

        {showImportSpec && onImportSpec ? (
          <Button variant="secondary" onClick={onImportSpec}>
            Import spec
          </Button>
        ) : null}

        {extraActions}

        <Button
          variant="ghost"
          className="theme-toggle-btn"
          onClick={() => onThemeModeChange(cycleTheme(themeMode))}
          title={themeLabel(themeMode)}
        >
          {themeMode === "dark" ? "Dark" : themeMode === "light" ? "Light" : "Auto"}
        </Button>

        <Button variant="ghost" onClick={onOpenSettings}>
          Settings
        </Button>
      </div>
    </header>
  );
}
