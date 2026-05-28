import type { RequestHistoryEntry } from "./collection-types";
import { Button } from "@/shared/ui/Button";

interface RequestHistoryPanelProps {
  entries: RequestHistoryEntry[];
  onReplay: (entry: RequestHistoryEntry) => void;
  onClose: () => void;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}

export function RequestHistoryPanel({ entries, onReplay, onClose }: RequestHistoryPanelProps) {
  return (
    <aside className="history-panel" aria-label="Request history">
      <div className="history-panel-header">
        <h3>History</h3>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
      <ul className="history-list">
        {entries.length === 0 ? (
          <li className="history-empty">No requests sent yet.</li>
        ) : (
          entries.map((entry) => (
            <li key={entry.id}>
              <button type="button" className="history-item" onClick={() => onReplay(entry)}>
                <span className={`method-badge method-${entry.method.toLowerCase()}`}>{entry.method}</span>
                <span className="history-url">{entry.url}</span>
                <span className="history-meta">
                  {entry.status ? `${entry.status} · ` : ""}
                  {entry.durationMs}ms · {timeAgo(entry.createdAt)}
                </span>
              </button>
            </li>
          ))
        )}
      </ul>
    </aside>
  );
}
