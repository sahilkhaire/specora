import type { ReactNode } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

interface AppShellProps {
  sidebar: ReactNode;
  main: ReactNode;
  docs?: ReactNode;
  history?: ReactNode;
}

export function AppShell({ sidebar, main, docs, history }: AppShellProps) {
  return (
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
  );
}
