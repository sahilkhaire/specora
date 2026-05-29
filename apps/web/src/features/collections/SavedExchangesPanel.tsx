import type { SavedExchange } from "./collection-types";
import { Button } from "@/shared/ui/Button";
import { statusBadgeClass } from "@/features/tryout/tryout-utils";

interface SavedExchangesPanelProps {
  exchanges: SavedExchange[];
  onLoad: (exchange: SavedExchange) => void;
  onDelete: (id: string) => void;
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

export function SavedExchangesPanel({ exchanges, onLoad, onDelete }: SavedExchangesPanelProps) {
  if (exchanges.length === 0) {
    return (
      <p className="empty-message saved-exchanges-empty">
        No saved request-response pairs yet. Send a request and click Save in the response area.
      </p>
    );
  }

  return (
    <ul className="saved-exchanges-list">
      {exchanges.map((exchange) => (
        <li key={exchange.id} className="saved-exchange-item">
          <div className="saved-exchange-main">
            <span className="saved-exchange-name">{exchange.name}</span>
            <span className="saved-exchange-meta">
              {exchange.response.status ? (
                <span className={statusBadgeClass(String(exchange.response.status))}>
                  {exchange.response.status}
                </span>
              ) : null}
              <span className="saved-exchange-timing">{exchange.response.durationMs} ms</span>
              <span className="saved-exchange-when">{formatWhen(exchange.createdAt)}</span>
            </span>
          </div>
          <div className="saved-exchange-actions">
            <Button variant="secondary" onClick={() => onLoad(exchange)}>
              Load
            </Button>
            <Button variant="ghost" onClick={() => onDelete(exchange.id)}>
              Delete
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
