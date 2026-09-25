import { useState } from "react";
import type { PipeRecord } from "../types";

interface VenueStat {
  name: string;
  pending: number;
  total: number;
}

interface FilterPanelProps {
  venues: VenueStat[];
  stops: string[];
  venue: string;
  stop: string;
  pipes: PipeRecord[];
  onVenueChange: (venue: string) => void;
  onStopChange: (stop: string) => void;
}

export function FilterPanel({
  venues,
  stops,
  venue,
  stop,
  pipes,
  onVenueChange,
  onStopChange,
}: FilterPanelProps) {
  const [addingVenue, setAddingVenue] = useState(false);
  const [newVenue, setNewVenue] = useState("");

  function pendingForStop(stopName: string): number {
    return pipes.filter(
      (p) =>
        p.venue === venue &&
        p.stop === stopName &&
        p.traces.some((t) => t.resolvedAt === null)
    ).length;
  }

  function confirmVenue() {
    const name = newVenue.trim();
    if (!name) return;
    onVenueChange(name);
    setNewVenue("");
    setAddingVenue(false);
  }

  return (
    <aside className="panel filter-panel">
      <h2>巡检位置</h2>

      <div className="filter-block">
        <div className="filter-head">
          <span>场馆</span>
          <button
            className="link-btn"
            onClick={() => setAddingVenue((v) => !v)}
          >
            {addingVenue ? "取消" : "+ 新场馆"}
          </button>
        </div>

        {addingVenue && (
          <div className="inline-add">
            <input
              className="input"
              autoFocus
              placeholder="教堂 / 音乐厅名称"
              value={newVenue}
              onChange={(e) => setNewVenue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmVenue()}
            />
            <button className="primary small" onClick={confirmVenue}>
              选定
            </button>
          </div>
        )}

        <div className="select-list">
          {venues.length === 0 && !addingVenue && (
            <p className="filter-hint">还没有场馆，点击「+ 新场馆」开始。</p>
          )}
          {venues.map((v) => (
            <button
              key={v.name}
              className={
                "select-item" + (venue === v.name ? " selected" : "")
              }
              onClick={() => onVenueChange(v.name)}
            >
              <span className="select-name">{v.name}</span>
              <span className="select-meta">
                {v.total} 管
                {v.pending > 0 && (
                  <b className="pending-badge">{v.pending} 待检</b>
                )}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="filter-block">
        <div className="filter-head">
          <span>音栓</span>
        </div>
        <div className="select-list">
          {!venue ? (
            <p className="filter-hint">请先选定场馆。</p>
          ) : stops.length === 0 ? (
            <p className="filter-hint">
              该场馆还没有音栓，在右侧直接输入音栓名称录入即可。
            </p>
          ) : (
            stops.map((s) => (
              <button
                key={s}
                className={
                  "select-item" + (stop === s ? " selected" : "")
                }
                onClick={() => onStopChange(s)}
              >
                <span className="select-name">{s}</span>
                <span className="select-meta">
                  {pendingForStop(s) > 0 && (
                    <b className="pending-badge">
                      {pendingForStop(s)} 待检
                    </b>
                  )}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}
