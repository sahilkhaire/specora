import { useEffect, useState } from "react";
import type { ThemeMode } from "@/app/header-types";
import { Modal } from "@/shared/ui/Modal";

interface SettingsViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  useProxy: boolean;
  proxyUrl: string;
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
  onProxyChange: (useProxy: boolean, proxyUrl: string) => void;
}

export function SettingsView({
  open,
  onOpenChange,
  useProxy,
  proxyUrl,
  themeMode,
  onThemeModeChange,
  onProxyChange
}: SettingsViewProps) {
  const [localProxyUrl, setLocalProxyUrl] = useState(proxyUrl);

  useEffect(() => {
    if (open) setLocalProxyUrl(proxyUrl);
  }, [open, proxyUrl]);

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Settings">
      <label>
        <span>Theme</span>
        <select value={themeMode} onChange={(e) => onThemeModeChange(e.target.value as ThemeMode)}>
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>

      <section className="settings-section">
        <label className="inline-switch">
          <span>Send try-out requests through a proxy</span>
          <input
            type="checkbox"
            checked={useProxy}
            onChange={(e) => onProxyChange(e.target.checked, localProxyUrl)}
          />
        </label>
        <p className="help-text">
          Use this when the API you're calling doesn't allow browser requests (CORS). Run{" "}
          <code>npx specora proxy</code> on your machine; requests then go browser → your machine → API.
        </p>
        {useProxy ? (
          <label>
            <span>Proxy URL</span>
            <input
              type="url"
              value={localProxyUrl}
              onChange={(e) => {
                setLocalProxyUrl(e.target.value);
                onProxyChange(true, e.target.value);
              }}
              placeholder="http://localhost:8787/proxy"
            />
          </label>
        ) : null}
      </section>
    </Modal>
  );
}
