import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { ThemeMode, WorkbenchHeaderConfig } from "@/app/header-types";
import {
  IconDownload,
  IconHistory,
  IconMonitor,
  IconMoon,
  IconSettings,
  IconSun,
  IconUpload
} from "@/shared/ui/icons";

interface HeaderSettingsMenuProps {
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
  onOpenSettings: () => void;
  onImportSpec?: () => void;
  sdkDownloadUrls?: { json?: string; yaml?: string };
  workbench?: WorkbenchHeaderConfig | null;
  showExportPostman?: boolean;
}

const themeOptions: Array<{ mode: ThemeMode; label: string; icon: typeof IconSun }> = [
  { mode: "light", label: "Light", icon: IconSun },
  { mode: "dark", label: "Dark", icon: IconMoon },
  { mode: "system", label: "System", icon: IconMonitor }
];

export function HeaderSettingsMenu({
  themeMode,
  onThemeModeChange,
  onOpenSettings,
  onImportSpec,
  sdkDownloadUrls,
  workbench,
  showExportPostman = true
}: HeaderSettingsMenuProps) {
  const hasSdkDownloads = Boolean(sdkDownloadUrls?.json || sdkDownloadUrls?.yaml);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="app-top-header-icon-btn"
          aria-label="Menu"
          title="Menu"
        >
          <IconSettings size={17} />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content className="header-menu-content" align="end" sideOffset={8}>
          {onImportSpec ? (
            <>
              <DropdownMenu.Item className="header-menu-item" onSelect={onImportSpec}>
                <span className="header-menu-item-icon">
                  <IconUpload size={15} />
                </span>
                <span className="header-menu-item-text">Import OpenAPI spec</span>
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="header-menu-separator" />
            </>
          ) : null}

          {hasSdkDownloads ? (
            <>
              {sdkDownloadUrls?.json ? (
                <DropdownMenu.Item className="header-menu-item" asChild>
                  <a href={sdkDownloadUrls.json} className="header-menu-item-link">
                    <span className="header-menu-item-icon">
                      <IconDownload size={15} />
                    </span>
                    <span className="header-menu-item-text">Download JSON</span>
                  </a>
                </DropdownMenu.Item>
              ) : null}
              {sdkDownloadUrls?.yaml ? (
                <DropdownMenu.Item className="header-menu-item" asChild>
                  <a href={sdkDownloadUrls.yaml} className="header-menu-item-link">
                    <span className="header-menu-item-icon">
                      <IconDownload size={15} />
                    </span>
                    <span className="header-menu-item-text">Download YAML</span>
                  </a>
                </DropdownMenu.Item>
              ) : null}
              <DropdownMenu.Separator className="header-menu-separator" />
            </>
          ) : null}

          {workbench ? (
            <>
              <DropdownMenu.Item className="header-menu-item" onSelect={workbench.onToggleHistory}>
                <span className="header-menu-item-icon">
                  <IconHistory size={15} />
                </span>
                <span className="header-menu-item-text">Request history</span>
                {workbench.historyOpen ? (
                  <span className="header-menu-check" aria-hidden="true">
                    ✓
                  </span>
                ) : null}
              </DropdownMenu.Item>
              {showExportPostman ? (
                <DropdownMenu.Item className="header-menu-item" onSelect={workbench.onExportPostman}>
                  <span className="header-menu-item-icon">
                    <IconDownload size={15} />
                  </span>
                  <span className="header-menu-item-text">Export Postman collection</span>
                </DropdownMenu.Item>
              ) : null}
              <DropdownMenu.Separator className="header-menu-separator" />
            </>
          ) : null}

          <DropdownMenu.Label className="header-menu-label">Appearance</DropdownMenu.Label>
          {themeOptions.map(({ mode, label, icon: Icon }) => (
            <DropdownMenu.Item
              key={mode}
              className="header-menu-item"
              onSelect={() => onThemeModeChange(mode)}
            >
              <span className="header-menu-item-icon">
                <Icon size={15} />
              </span>
              <span className="header-menu-item-text">{label}</span>
              {themeMode === mode ? (
                <span className="header-menu-check" aria-hidden="true">
                  ✓
                </span>
              ) : null}
            </DropdownMenu.Item>
          ))}

          <DropdownMenu.Separator className="header-menu-separator" />

          <DropdownMenu.Item className="header-menu-item" onSelect={onOpenSettings}>
            <span className="header-menu-item-icon">
              <IconSettings size={15} />
            </span>
            <span className="header-menu-item-text">Settings</span>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
