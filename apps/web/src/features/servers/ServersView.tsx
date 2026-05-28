interface ServersViewProps {
  spec: Record<string, unknown> | null;
  currentServerUrl: string;
  onServerUrlChange: (url: string) => void;
}

export function ServersView({ spec, currentServerUrl, onServerUrlChange }: ServersViewProps) {
  const servers = spec?.servers as Array<Record<string, unknown>> | undefined;

  if (!spec) {
    return (
      <div className="panel-card">
        <h2>Servers</h2>
        <p className="empty-message">Load a spec to view server configuration.</p>
      </div>
    );
  }

  if (!servers || servers.length === 0) {
    return (
      <div className="panel-card">
        <h2>Servers</h2>
        <p className="empty-message">No servers defined in this specification.</p>
      </div>
    );
  }

  return (
    <div className="servers-view">
      <div className="panel-card">
        <h2>Servers</h2>
        <p className="text-muted">
          {servers.length} server(s) available for this API
        </p>
      </div>

      <div className="panel-card">
        <h3>Current Server</h3>
        <input
          type="text"
          value={currentServerUrl}
          onChange={(e) => onServerUrlChange(e.target.value)}
          placeholder="https://api.example.com"
          className="server-url-input"
        />
        <p className="text-muted">
          This URL will be used for Try It Out requests
        </p>
      </div>

      <div className="panel-card">
        <h3>Available Servers</h3>
        <div className="servers-list">
          {servers.map((server, idx) => {
            const url = server.url as string;
            const description = server.description as string | undefined;
            const variables = server.variables as Record<string, unknown> | undefined;

            return (
              <div key={idx} className="server-item">
                <div className="server-header">
                  <code className="server-url">{url}</code>
                  <button
                    type="button"
                    className="btn-secondary server-select-btn"
                    onClick={() => onServerUrlChange(url)}
                  >
                    Use This Server
                  </button>
                </div>

                {description && <p className="server-description">{description}</p>}

                {variables && Object.keys(variables).length > 0 && (
                  <details className="server-variables">
                    <summary>Variables ({Object.keys(variables).length})</summary>
                    <table className="variables-table">
                      <thead>
                        <tr>
                          <th>Variable</th>
                          <th>Default</th>
                          <th>Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(variables).map(([varName, varDef]) => {
                          const varObj = varDef as Record<string, unknown>;
                          return (
                            <tr key={varName}>
                              <td className="var-name">{`{${varName}}`}</td>
                              <td className="var-default">{String(varObj.default || "")}</td>
                              <td className="var-desc">{String(varObj.description || "")}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
