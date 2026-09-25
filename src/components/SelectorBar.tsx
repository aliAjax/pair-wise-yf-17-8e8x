import { useState } from "react";
import type { Stop, StopCategory, Venue, VenueKind } from "../types";
import { categoryLabels, venueKindLabels } from "../domain/inspection";

interface SelectorBarProps {
  venues: Venue[];
  stops: Stop[];
  venueId: string | null;
  stopId: string | null;
  showStopSelector: boolean;
  onVenueChange: (venueId: string) => void;
  onStopChange: (stopId: string) => void;
  onAddVenue: (name: string, kind: VenueKind) => void;
  onAddStop: (name: string, category: StopCategory) => void;
}

export function SelectorBar({
  venues,
  stops,
  venueId,
  stopId,
  showStopSelector,
  onVenueChange,
  onStopChange,
  onAddVenue,
  onAddStop,
}: SelectorBarProps) {
  const venueStops = venueId ? stops.filter((s) => s.venueId === venueId) : [];

  const [addingVenue, setAddingVenue] = useState(false);
  const [newVenueName, setNewVenueName] = useState("");
  const [newVenueKind, setNewVenueKind] = useState<VenueKind>("church");

  const [addingStop, setAddingStop] = useState(false);
  const [newStopName, setNewStopName] = useState("");
  const [newStopCategory, setNewStopCategory] = useState<StopCategory>("principal");

  function submitVenue() {
    const name = newVenueName.trim();
    if (!name) return;
    onAddVenue(name, newVenueKind);
    setNewVenueName("");
    setAddingVenue(false);
  }

  function submitStop() {
    const name = newStopName.trim();
    if (!name || !venueId) return;
    onAddStop(name, newStopCategory);
    setNewStopName("");
    setAddingStop(false);
  }

  return (
    <section className="panel selector-bar no-print">
      <div className="selector-group">
        <label>
          <span>场馆</span>
          <select value={venueId ?? ""} onChange={(e) => onVenueChange(e.target.value)}>
            {venues.length === 0 && <option value="">暂无场馆</option>}
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}（{venueKindLabels[v.kind]}）
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="ghost" onClick={() => setAddingVenue((v) => !v)}>
          {addingVenue ? "取消" : "＋ 新场馆"}
        </button>
      </div>

      {addingVenue && (
        <div className="inline-add">
          <input
            placeholder="教堂或音乐厅名称"
            value={newVenueName}
            onChange={(e) => setNewVenueName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitVenue()}
            autoFocus
          />
          <select value={newVenueKind} onChange={(e) => setNewVenueKind(e.target.value as VenueKind)}>
            <option value="church">{venueKindLabels.church}</option>
            <option value="hall">{venueKindLabels.hall}</option>
          </select>
          <button type="button" className="primary small" onClick={submitVenue}>
            添加
          </button>
        </div>
      )}

      {showStopSelector && (
        <>
          <div className="selector-group">
            <label>
              <span>音栓</span>
              <select value={stopId ?? ""} onChange={(e) => onStopChange(e.target.value)} disabled={!venueId}>
                {venueStops.length === 0 && <option value="">该场馆暂无音栓</option>}
                {venueStops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {categoryLabels[s.category]}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="ghost"
              disabled={!venueId}
              onClick={() => setAddingStop((v) => !v)}
            >
              {addingStop ? "取消" : "＋ 新音栓"}
            </button>
          </div>

          {addingStop && (
            <div className="inline-add">
              <input
                placeholder="音栓名称，如 Principal 4'"
                value={newStopName}
                onChange={(e) => setNewStopName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitStop()}
                autoFocus
              />
              <select
                value={newStopCategory}
                onChange={(e) => setNewStopCategory(e.target.value as StopCategory)}
              >
                <option value="principal">{categoryLabels.principal}</option>
                <option value="reed">{categoryLabels.reed}</option>
                <option value="mixture">{categoryLabels.mixture}</option>
                <option value="bass">{categoryLabels.bass}</option>
              </select>
              <button type="button" className="primary small" onClick={submitStop}>
                添加
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
