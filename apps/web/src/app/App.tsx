import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Toaster, toast } from "sonner";
import { detectSpecVersion } from "@specora/core";
import {
  detectDefaultServerUrl,
  extractOperations,
  filterPublicOperations
} from "@/features/spec/spec-utils";
import {
  deploymentConfig,
  getSpecoraEmbedConfig,
  isEmbedSurface,
  isSdkEmbeddedContext,
  showImportSpec as canImportSpec
} from "@/config/deployment";
import { useDataContext } from "@/data/DataProvider";
import { getEmbedWorkspaceId } from "@/data/storage-scope";
import { AdminView } from "@/features/admin/AdminView";
import { PublishSettings } from "@/features/publish/PublishSettings";
import { useEnvironments } from "@/features/environments/use-environments";
import { EnvPanel } from "@/features/environments/EnvPanel";
import { SettingsView } from "@/features/settings/SettingsView";
import { useWorkspaces } from "@/features/workspaces/use-workspaces";
import type { SpecSource } from "@/features/workspaces/workspace-types";
import { fetchPublishedSpec, fetchSpecFromUrl, type LoadedSpec } from "@/features/spec/load-spec";
import { SpecImportDialog } from "@/features/spec/SpecImportDialog";
import { sampleSpecUrl } from "@/features/spec/sample-spec";
import { ApiClientWorkbench } from "@/app/ApiClientWorkbench";
import { AppHeader } from "@/app/AppHeader";
import type { WorkbenchHeaderConfig } from "@/app/header-types";
import { useThemeMode } from "@/app/use-theme-mode";
import { Button } from "@/shared/ui/Button";
import { EmptyState } from "@/shared/ui/EmptyState";

export function App() {
  const { themeMode, setThemeMode, resolvedTheme } = useThemeMode();
  const embedConfig = getSpecoraEmbedConfig();
  const embedSpecUrl = embedConfig?.specUrl;
  /** Read-only published docs site (VITE_APP_SURFACE=docs) backed by the API. */
  const isPublishedDocs = deploymentConfig.surface === "docs" && !embedSpecUrl;
  const usesExternalSpec = Boolean(embedSpecUrl) || isPublishedDocs;
  const allowImportSpec = canImportSpec();

  const [externalSpec, setExternalSpec] = useState<LoadedSpec | null>(null);
  const [externalError, setExternalError] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [useProxy, setUseProxy] = useState(deploymentConfig.tryoutUseProxy);
  const [proxyUrl, setProxyUrl] = useState(deploymentConfig.tryoutProxyUrl);
  const [showSpecLoader, setShowSpecLoader] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isEnvPanelOpen, setIsEnvPanelOpen] = useState(false);
  const [workbenchHeader, setWorkbenchHeader] = useState<WorkbenchHeaderConfig | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const { backend } = useDataContext();
  const specPromptDismissedRef = useRef<Set<string>>(new Set());

  const {
    workspaces,
    activeWorkspaceId,
    activeWorkspace,
    hydrated: workspacesHydrated,
    createWorkspace,
    updateWorkspaceSpec,
    renameWorkspace,
    deleteWorkspace,
    switchWorkspace
  } = useWorkspaces();

  const {
    environments,
    activeEnvId,
    activeEnv,
    createEnvironment,
    updateEnvironment,
    deleteEnvironment,
    switchEnvironment
  } = useEnvironments();

  useEffect(() => {
    if (!usesExternalSpec) return;
    let cancelled = false;
    const load = embedSpecUrl ? fetchSpecFromUrl(embedSpecUrl) : fetchPublishedSpec();
    load
      .then((loaded) => {
        if (!cancelled) setExternalSpec(loaded);
      })
      .catch((error: unknown) => {
        if (!cancelled) setExternalError(error instanceof Error ? error.message : "Failed to load spec.");
      });
    return () => {
      cancelled = true;
    };
  }, [embedSpecUrl, usesExternalSpec]);

  // Hosted app: make sure there is always an active workspace.
  useEffect(() => {
    if (!workspacesHydrated || isSdkEmbeddedContext()) return;
    if (workspaces.length === 0) {
      createWorkspace("Default Workspace", "Primary workspace");
    } else if (!activeWorkspace) {
      switchWorkspace(workspaces[0]!.id);
    }
  }, [workspacesHydrated, workspaces, activeWorkspace, createWorkspace, switchWorkspace]);

  const spec = usesExternalSpec ? (externalSpec?.spec ?? null) : (activeWorkspace?.spec ?? null);
  const specVersionLabel = useMemo(() => (spec ? detectSpecVersion(spec).label : ""), [spec]);
  const needsSpecImport = allowImportSpec && Boolean(activeWorkspace) && !activeWorkspace?.spec;

  // Prompt for a spec when an empty workspace becomes active (once per workspace per session).
  useEffect(() => {
    if (!needsSpecImport || !activeWorkspace) return;
    if (!specPromptDismissedRef.current.has(activeWorkspace.id)) {
      setShowSpecLoader(true);
    }
  }, [needsSpecImport, activeWorkspace]);

  // New spec: default the server URL from the environment or the spec's `servers`.
  useEffect(() => {
    if (spec) setServerUrl(activeEnv?.baseUrl || detectDefaultServerUrl(spec));
    // Only when the spec itself changes; environment switches are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec]);

  useEffect(() => {
    if (activeEnv?.baseUrl) setServerUrl(activeEnv.baseUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEnvId]);

  const operations = useMemo(() => {
    if (!spec) return [];
    const all = extractOperations(spec);
    const applyPublicFilter = isEmbedSurface() && !isPublishedDocs && !embedConfig?.includeAll;
    return applyPublicFilter ? filterPublicOperations(all, spec) : all;
  }, [spec, isPublishedDocs, embedConfig?.includeAll]);

  const openSpecLoader = useCallback(() => setShowSpecLoader(true), []);

  const closeSpecLoader = useCallback(() => {
    if (needsSpecImport && activeWorkspace) {
      specPromptDismissedRef.current.add(activeWorkspace.id);
    }
    setShowSpecLoader(false);
  }, [needsSpecImport, activeWorkspace]);

  const handleSpecLoaded = useCallback(
    (loaded: LoadedSpec, source: SpecSource) => {
      if (activeWorkspace) {
        updateWorkspaceSpec(activeWorkspace.id, source, loaded.spec);
        specPromptDismissedRef.current.delete(activeWorkspace.id);
      }
      setShowSpecLoader(false);
    },
    [activeWorkspace, updateWorkspaceSpec]
  );

  const handleImportEnvironment = useCallback(
    (name: string, variables: Record<string, string>) => {
      createEnvironment(
        {
          name,
          baseUrl: variables.baseUrl ?? variables.base_url ?? "",
          auth: { type: "none", value: "", keyName: "X-API-Key" },
          variables
        },
        { activate: true }
      );
      toast.success(`Environment "${name}" imported and activated`);
    },
    [createEnvironment]
  );

  const loadSample = useCallback(() => {
    const url = sampleSpecUrl();
    fetchSpecFromUrl(url)
      .then((loaded) => handleSpecLoaded(loaded, { type: "url", value: url }))
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Failed to load sample."));
  }, [handleSpecLoaded]);

  const info = (spec?.info as Record<string, unknown> | undefined) ?? {};
  const hostedApp = !isSdkEmbeddedContext() && Boolean(deploymentConfig.apiBaseUrl);
  // Publishing needs the workspace to exist server-side, i.e. a signed-in (synced) account.
  const canPublish = hostedApp && backend === "remote" && Boolean(activeWorkspace);
  const canAdmin = hostedApp && deploymentConfig.mode === "enterprise";
  const workbenchWorkspaceId = isSdkEmbeddedContext() ? getEmbedWorkspaceId() : activeWorkspaceId;
  const sdkDownloadUrls = embedSpecUrl
    ? { json: embedConfig?.downloadJsonUrl, yaml: embedConfig?.downloadYamlUrl }
    : undefined;

  function renderMain() {
    if (spec && workbenchWorkspaceId) {
      return (
        <ApiClientWorkbench
          key={workbenchWorkspaceId}
          workspaceId={workbenchWorkspaceId}
          spec={spec}
          operations={operations}
          onWorkbenchHeaderChange={setWorkbenchHeader}
          serverUrl={serverUrl}
          onServerUrlChange={setServerUrl}
          useProxy={useProxy}
          onUseProxyChange={setUseProxy}
          proxyUrl={proxyUrl}
          onProxyUrlChange={setProxyUrl}
          activeEnv={activeEnv}
          onImportEnvironment={handleImportEnvironment}
        />
      );
    }

    if (usesExternalSpec) {
      return externalError ? (
        <EmptyState title="Couldn't load the API specification" description={externalError} />
      ) : (
        <p className="empty-message" role="status">
          Loading API specification…
        </p>
      );
    }

    if (!workspacesHydrated) {
      return null;
    }

    return (
      <EmptyState
        title="No API loaded"
        description="Import an OpenAPI or Swagger spec to explore and call its endpoints."
        action={
          allowImportSpec ? (
            <div className="ui-empty-state-actions">
              <Button onClick={openSpecLoader}>Import OpenAPI spec</Button>
              <Button variant="secondary" onClick={loadSample}>
                Try the Petstore sample
              </Button>
            </div>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="app-shell app-shell-with-header">
      <Toaster richColors position="bottom-right" theme={resolvedTheme} />
      <AppHeader
        apiTitle={String(info.title ?? "No API loaded")}
        apiVersion={String(info.version ?? "—")}
        specVersionLabel={specVersionLabel || undefined}
        hasSpec={Boolean(spec)}
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        onSwitchWorkspace={switchWorkspace}
        onCreateWorkspace={(name, description) => createWorkspace(name, description)}
        onRenameWorkspace={renameWorkspace}
        onDeleteWorkspace={deleteWorkspace}
        activeEnvName={activeEnv?.name}
        onOpenEnvironment={() => setIsEnvPanelOpen(true)}
        onImportSpec={allowImportSpec ? openSpecLoader : undefined}
        onOpenSettings={() => setShowSettings(true)}
        themeMode={themeMode}
        onThemeModeChange={setThemeMode}
        showImportSpec={allowImportSpec}
        sdkDownloadUrls={sdkDownloadUrls}
        workbench={spec ? workbenchHeader : null}
        showExportPostman={!isSdkEmbeddedContext()}
        onOpenPublish={canPublish ? () => setPublishOpen(true) : undefined}
        onOpenAdmin={canAdmin ? () => setAdminOpen(true) : undefined}
      />

      <div className="app-body">
        <main className={`main-panel ${spec ? "main-panel-client" : ""}`}>{renderMain()}</main>
      </div>

      <SettingsView
        open={showSettings}
        onOpenChange={setShowSettings}
        useProxy={useProxy}
        proxyUrl={proxyUrl}
        themeMode={themeMode}
        onThemeModeChange={setThemeMode}
        onProxyChange={(use, url) => {
          setUseProxy(use);
          setProxyUrl(url);
        }}
      />

      {showSpecLoader && allowImportSpec && (
        <SpecImportDialog
          key={activeWorkspaceId}
          required={needsSpecImport}
          initialSource={activeWorkspace?.specSource ?? null}
          onClose={closeSpecLoader}
          onLoaded={handleSpecLoaded}
        />
      )}

      {canPublish && activeWorkspace ? (
        <PublishSettings open={publishOpen} onOpenChange={setPublishOpen} workspaceId={activeWorkspace.id} />
      ) : null}
      {canAdmin ? (
        <AdminView open={adminOpen} onOpenChange={setAdminOpen} activeWorkspaceId={activeWorkspaceId} />
      ) : null}

      <EnvPanel
        isOpen={isEnvPanelOpen}
        onClose={() => setIsEnvPanelOpen(false)}
        environments={environments}
        activeEnvId={activeEnvId}
        onSwitch={switchEnvironment}
        onCreate={createEnvironment}
        onUpdate={updateEnvironment}
        onDelete={deleteEnvironment}
      />
    </div>
  );
}
