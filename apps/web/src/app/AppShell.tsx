import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { ShellNavContext, type ShellPane as Pane } from "@/shared/ui/shell-nav";

const MOBILE_QUERY = "(max-width: 768px)";

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(MOBILE_QUERY).matches
  );

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(MOBILE_QUERY);
    const update = () => setIsMobile(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return isMobile;
}

interface AppShellProps {
  sidebar: ReactNode;
  main: ReactNode;
  docs?: ReactNode;
  /** Desktop only: whether the docs panel is shown. Narrow screens always offer a Docs tab. */
  docsOpen?: boolean;
  history?: ReactNode;
}

export function AppShell({ sidebar, main, docs: docsContent, docsOpen = true, history }: AppShellProps) {
  const isMobile = useIsMobile();
  const [pane, setPane] = useState<Pane>("main");
  const showPane = useCallback((next: Pane) => setPane(next), []);
  const docs = isMobile || docsOpen ? docsContent : undefined;
  const activePane = pane === "docs" && !docs ? "main" : pane;

  if (isMobile) {
    const tabs: Array<{ id: Pane; label: string }> = [
      { id: "sidebar", label: "Requests" },
      { id: "main", label: "Request" },
      ...(docs ? [{ id: "docs" as const, label: "Docs" }] : [])
    ];

    return (
      <ShellNavContext.Provider value={{ showPane }}>
        <div className="app-client-shell app-client-shell--mobile">
          <div className="ui-tabs app-mobile-tabs" role="tablist" aria-label="Workbench panes">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activePane === tab.id}
                onClick={() => setPane(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="app-mobile-pane" role="tabpanel">
            {activePane === "sidebar" ? sidebar : activePane === "docs" ? docs : main}
          </div>
          {history}
        </div>
      </ShellNavContext.Provider>
    );
  }

  return (
    <ShellNavContext.Provider value={{ showPane }}>
      <div className="app-client-shell">
        <div className="app-client-body">
          <PanelGroup direction="horizontal" className="app-panel-group">
            <Panel defaultSize={22} minSize={16} maxSize={40} className="app-panel app-panel-sidebar">
              {sidebar}
            </Panel>
            <PanelResizeHandle className="app-panel-resize" />
            <Panel defaultSize={docs ? 48 : 58} minSize={30} className="app-panel app-panel-main">
              {main}
            </Panel>
            {docs ? (
              <>
                <PanelResizeHandle className="app-panel-resize" />
                <Panel defaultSize={34} minSize={24} maxSize={50} className="app-panel app-panel-docs">
                  {docs}
                </Panel>
              </>
            ) : null}
          </PanelGroup>
          {history}
        </div>
      </div>
    </ShellNavContext.Provider>
  );
}
