import { useState } from "react";

interface SettingsViewProps {
  spec: Record<string, unknown> | null;
  useProxy: boolean;
  proxyUrl: string;
  themeMode: "light" | "dark" | "system";
  resolvedTheme: "light" | "dark";
  onThemeModeChange: (mode: "light" | "dark" | "system") => void;
  onProxyChange: (useProxy: boolean, proxyUrl: string) => void;
}

export function SettingsView({
  spec,
  useProxy,
  proxyUrl,
  themeMode,
  resolvedTheme,
  onThemeModeChange,
  onProxyChange,
}: SettingsViewProps) {
  const [localProxyUrl, setLocalProxyUrl] = useState(proxyUrl);

  const info = (spec?.info as Record<string, unknown> | undefined) ?? {};
  const title = String(info.title ?? "Untitled API");
  const version = String(info.version ?? "unknown");
  const description = info.description as string | undefined;
  const contact = info.contact as Record<string, unknown> | undefined;
  const license = info.license as Record<string, unknown> | undefined;
  
  const contactName = contact?.name as string | undefined;
  const contactEmail = contact?.email as string | undefined;
  const contactUrl = contact?.url as string | undefined;

  function handleProxyToggle(checked: boolean) {
    onProxyChange(checked, localProxyUrl);
  }

  function handleProxyUrlChange(url: string) {
    setLocalProxyUrl(url);
    if (useProxy) {
      onProxyChange(true, url);
    }
  }

  return (
    <div className="settings-view">
      {spec && (
        <div className="panel-card">
          <h2>API Information</h2>
          <dl className="info-list">
            <dt>Title</dt>
            <dd>{title}</dd>

            <dt>Version</dt>
            <dd>{version}</dd>

            {description && (
              <>
                <dt>Description</dt>
                <dd>{description}</dd>
              </>
            )}

            {contact && (
              <>
                <dt>Contact</dt>
                <dd>
                  {contactName && <div>{contactName}</div>}
                  {contactEmail && (
                    <div>
                      <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
                    </div>
                  )}
                  {contactUrl && (
                    <div>
                      <a href={contactUrl} target="_blank" rel="noopener noreferrer">
                        {contactUrl}
                      </a>
                    </div>
                  )}
                </dd>
              </>
            )}

            {license && (
              <>
                <dt>License</dt>
                <dd>
                  {license.url ? (
                    <a href={String(license.url)} target="_blank" rel="noopener noreferrer">
                      {String(license.name || license.url)}
                    </a>
                  ) : (
                    String(license.name || "")
                  )}
                </dd>
              </>
            )}
          </dl>
        </div>
      )}

      <div className="panel-card">
        <h2>Appearance</h2>
        <p className="text-muted">Choose how Specora should render across light and dark environments</p>

        <div className="setting-item">
          <label>
            <span>Theme</span>
            <select
              value={themeMode}
              onChange={(e) => onThemeModeChange(e.target.value as "light" | "dark" | "system")}
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <p className="help-text">Current: {resolvedTheme === "dark" ? "Dark" : "Light"}</p>
        </div>
      </div>

      <div className="panel-card">
        <h2>Proxy Settings</h2>
        <p className="text-muted">
          Route try-out requests through a local proxy on your machine to avoid browser CORS limits
        </p>

        <div className="setting-item">
          <label className="inline-switch">
            <span>Enable try-out proxy</span>
            <input
              type="checkbox"
              checked={useProxy}
              onChange={(e) => handleProxyToggle(e.target.checked)}
            />
          </label>
        </div>

        {useProxy && (
          <div className="setting-item">
            <label>
              <span>Proxy URL</span>
              <input
                type="text"
                value={localProxyUrl}
                onChange={(e) => handleProxyUrlChange(e.target.value)}
                placeholder="http://localhost:8787/proxy"
              />
            </label>
            <p className="help-text">
              Run <code>npx specora proxy --port 8787</code> locally, then use{" "}
              <code>http://localhost:8787/proxy</code>.
            </p>
          </div>
        )}
      </div>

      <div className="panel-card">
        <h2>About Specora</h2>
        <p>
          Specora is a modern OpenAPI documentation viewer with interactive API testing capabilities.
        </p>
        <dl className="info-list">
          <dt>Version</dt>
          <dd>0.1.0</dd>

          <dt>Features</dt>
          <dd>
            <ul>
              <li>Interactive API documentation</li>
              <li>Try It Out functionality</li>
              <li>Environment management</li>
              <li>Schema visualization</li>
              <li>Local CORS proxy (CLI)</li>
            </ul>
          </dd>
        </dl>
      </div>
    </div>
  );
}
