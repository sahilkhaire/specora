import { useState } from "react";
import { SchemasView } from "@/features/schemas/SchemasView";
import { SecurityView } from "@/features/security/SecurityView";
import { ServersView } from "@/features/servers/ServersView";
import { Modal } from "@/shared/ui/Modal";
import { ApiInfoView } from "./ApiInfoView";

type Tab = "info" | "servers" | "security" | "schemas";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "info", label: "Overview" },
  { id: "servers", label: "Servers" },
  { id: "security", label: "Security" },
  { id: "schemas", label: "Schemas" }
];

interface ApiOverviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spec: Record<string, unknown>;
  serverUrl: string;
  onServerUrlChange: (url: string) => void;
}

/** Spec-wide reference: servers, security schemes, and component schemas. */
export function ApiOverviewDialog({ open, onOpenChange, spec, serverUrl, onServerUrlChange }: ApiOverviewDialogProps) {
  const [tab, setTab] = useState<Tab>("info");

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="API overview" size="wide">
      <div className="ui-tabs" role="tablist" aria-label="API overview sections">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={tab === entry.id}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === "info" ? <ApiInfoView spec={spec} /> : null}
        {tab === "servers" ? (
          <ServersView spec={spec} currentServerUrl={serverUrl} onServerUrlChange={onServerUrlChange} />
        ) : null}
        {tab === "security" ? <SecurityView spec={spec} /> : null}
        {tab === "schemas" ? <SchemasView spec={spec} /> : null}
      </div>
    </Modal>
  );
}
