import { isFullAppSurface, showEnvironmentInHeader, showWorkspaceManagement } from "@/config/deployment";
import { HeaderSettingsMenu } from "@/app/HeaderSettingsMenu";
import type { ThemeMode, WorkbenchHeaderConfig } from "@/app/header-types";
import { WorkspaceSelector } from "@/features/workspaces/WorkspaceSelector";
import type { Workspace } from "@/features/workspaces/workspace-types";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { IconPanelRight } from "@/shared/ui/icons";

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
  sdkDownloadUrls?: { json?: string; yaml?: string };
  workbench?: WorkbenchHeaderConfig | null;
  showExportPostman?: boolean;
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
  sdkDownloadUrls,
  workbench,
  showExportPostman = true
}: AppHeaderProps) {
  const showWorkspace = showWorkspaceManagement();
  const showEnvironment = showEnvironmentInHeader();
  const compact = Boolean(workbench);

  return (
    <header
      className={`app-top-header${compact ? " app-top-header--compact" : ""}`}
      aria-label="Application header"
    >
      <div className="app-top-header-start">
        <div className="app-top-header-brand">
          <span className="app-top-header-logo" aria-hidden="true">
            S
          </span>
          {!compact ? (
            <div className="app-top-header-brand-text">
              <span className="app-top-header-product">Specora</span>
              <span className="app-top-header-tagline">API client</span>
            </div>
          ) : (
            <span className="app-top-header-product">Specora</span>
          )}
        </div>

        {showWorkspace ? (
          <>
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

            <span className="app-top-header-inline-separator" aria-hidden="true" />
          </>
        ) : null}

        {showEnvironment ? (
          activeEnvName ? (
            <button type="button" className="app-top-header-env-chip" onClick={onOpenEnvironment}>
              <span className="app-top-header-env-name">{activeEnvName}</span>
            </button>
          ) : (
            <Button variant="ghost" className="app-top-header-btn" onClick={onOpenEnvironment}>
              Environment
            </Button>
          )
        ) : null}
      </div>

      {!compact ? (
        <div className="app-top-header-center">
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
        </div>
      ) : null}

      <nav className="app-top-header-toolbar" aria-label="Header actions">
        {workbench ? (
          <button
            type="button"
            className={`app-top-header-icon-btn${workbench.schemaPanelOpen ? " app-top-header-icon-btn--active" : ""}`}
            onClick={workbench.onToggleSchemaPanel}
            aria-label={workbench.schemaPanelOpen ? "Hide schema panel" : "Show schema panel"}
            aria-pressed={workbench.schemaPanelOpen}
            title={workbench.schemaPanelOpen ? "Hide schema panel" : "Show schema panel"}
          >
            <IconPanelRight size={17} />
          </button>
        ) : null}
        <HeaderSettingsMenu
          themeMode={themeMode}
          onThemeModeChange={onThemeModeChange}
          onOpenSettings={onOpenSettings}
          onImportSpec={showImportSpec && onImportSpec ? onImportSpec : undefined}
          sdkDownloadUrls={sdkDownloadUrls}
          workbench={workbench}
          showExportPostman={showExportPostman}
        />
      </nav>
    </header>
  );
}
