interface ServersViewProps {
  spec: Record<string, unknown> | null;
  currentServerUrl: string;
  onServerUrlChange: (url: string) => void;
}

interface ServerEntry {
  url: string;
  description?: string;
  variables?: Record<string, unknown>;
}

/** OpenAPI 3 `servers`, or a synthesized list from Swagger 2.0 `schemes`/`host`/`basePath`. */
export function listServers(spec: Record<string, unknown> | null): ServerEntry[] {
  if (!spec) return [];
  if (Array.isArray(spec.servers)) {
    return spec.servers
      .filter((server): server is Record<string, unknown> => Boolean(server) && typeof server === "object")
      .filter((server) => typeof server.url === "string")
      .map((server) => ({
        url: server.url as string,
        description: typeof server.description === "string" ? server.description : undefined,
        variables:
          server.variables && typeof server.variables === "object"
            ? (server.variables as Record<string, unknown>)
            : undefined
      }));
  }
  if (typeof spec.host === "string" && spec.host) {
    const basePath = typeof spec.basePath === "string" ? spec.basePath : "";
    const schemes = Array.isArray(spec.schemes) && spec.schemes.length > 0 ? spec.schemes : ["https"];
    return schemes
      .filter((scheme): scheme is string => typeof scheme === "string")
      .map((scheme) => ({ url: `${scheme}://${spec.host as string}${basePath}` }));
  }
  return [];
}

/** Fill `{name}` placeholders with each variable's declared default. */
export function resolveServerUrl(server: ServerEntry): string {
  return server.url.replace(/\{([^}]+)\}/g, (match, name: string) => {
    const definition = server.variables?.[name] as { default?: unknown } | undefined;
    return definition && definition.default !== undefined ? String(definition.default) : match;
  });
}

export function ServersView({ spec, currentServerUrl, onServerUrlChange }: ServersViewProps) {
  const servers = listServers(spec);

  return (
    <div className="overview-section">
      <label>
        <span>Server used for requests</span>
        <input
          type="url"
          value={currentServerUrl}
          onChange={(e) => onServerUrlChange(e.target.value)}
          placeholder="https://api.example.com"
        />
      </label>

      {servers.length === 0 ? (
        <p className="empty-message">This specification doesn't declare any servers.</p>
      ) : (
        <ul className="overview-list">
          {servers.map((server) => {
            const resolved = resolveServerUrl(server);
            const inUse = resolved === currentServerUrl;
            const variables = server.variables ? Object.entries(server.variables) : [];
            return (
              <li key={server.url} className="overview-list-item">
                <div className="overview-list-row">
                  <code>{server.url}</code>
                  {inUse ? (
                    <span className="overview-pill">In use</span>
                  ) : (
                    <button type="button" className="ui-btn ui-btn-secondary" onClick={() => onServerUrlChange(resolved)}>
                      Use
                    </button>
                  )}
                </div>
                {server.description ? <p className="help-text">{server.description}</p> : null}
                {variables.length > 0 ? (
                  <table className="overview-table">
                    <thead>
                      <tr>
                        <th>Variable</th>
                        <th>Default</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {variables.map(([name, definition]) => {
                        const def = (definition ?? {}) as Record<string, unknown>;
                        return (
                          <tr key={name}>
                            <td>
                              <code>{`{${name}}`}</code>
                            </td>
                            <td>{String(def.default ?? "")}</td>
                            <td>{String(def.description ?? "")}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
