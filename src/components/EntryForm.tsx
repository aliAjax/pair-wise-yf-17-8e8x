import { useEffect, useMemo, useState } from "react";
import { CENT_LIMIT, anomalyReasons, pipeKey } from "../domain";
import type { PipeDraft, PipeRecord, ReedStatus } from "../types";

interface EntryFormProps {
  pipes: PipeRecord[];
  venueNames: string[];
  stopsForVenue: (venue: string) => string[];
  selectedVenue: string;
  selectedStop: string;
  /** 非 null 时表单载入该音管数据进行编辑 */
  editing: PipeRecord | null;
  /** 自增编号变化时把表单重置为新建模式 */
  resetToken: number;
  onSave: (draft: PipeDraft) => void;
  onCancelEdit: () => void;
}

function emptyDraft(venue = "", stop = ""): PipeDraft {
  return {
    venue,
    stop,
    pipeNo: "",
    pitch: "",
    cents: "",
    temperature: "",
    humidity: "",
    reed: "ok",
    reedNote: "",
    note: "",
  };
}

function toDraft(r: PipeRecord): PipeDraft {
  return {
    venue: r.venue,
    stop: r.stop,
    pipeNo: r.pipeNo,
    pitch: r.current.pitch,
    cents: String(r.current.cents),
    temperature: String(r.current.temperature),
    humidity: String(r.current.humidity),
    reed: r.current.reed,
    reedNote: r.current.reedNote,
    note: r.current.note,
  };
}

function isNumeric(value: string): boolean {
  return value.trim() !== "" && Number.isFinite(Number(value));
}

export function EntryForm({
  pipes,
  venueNames,
  stopsForVenue,
  selectedVenue,
  selectedStop,
  editing,
  resetToken,
  onSave,
  onCancelEdit,
}: EntryFormProps) {
  const [draft, setDraft] = useState<PipeDraft>(() =>
    emptyDraft(selectedVenue, selectedStop)
  );
  const [errors, setErrors] = useState<Partial<Record<keyof PipeDraft, string>>>(
    {}
  );
  const [tried, setTried] = useState(false);

  // 从左侧筛选面板选定场馆 / 音栓时，同步为录入目标
  useEffect(() => {
    setDraft((d) => ({ ...d, venue: selectedVenue, stop: selectedStop }));
  }, [selectedVenue, selectedStop]);

  // 进入编辑模式
  useEffect(() => {
    if (editing) {
      setDraft(toDraft(editing));
      setErrors({});
      setTried(false);
    }
  }, [editing]);

  // 保存完成后重置（保留场馆 / 音栓，便于连续录入同排音管）
  useEffect(() => {
    if (resetToken > 0) {
      setDraft((d) => emptyDraft(d.venue, d.stop));
      setErrors({});
      setTried(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetToken]);

  const set = <K extends keyof PipeDraft>(key: K, value: PipeDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const duplicateOf = useMemo(() => {
    if (!draft.venue.trim() || !draft.stop.trim() || !draft.pipeNo.trim()) {
      return undefined;
    }
    const key = pipeKey(draft.venue, draft.stop, draft.pipeNo);
    return pipes.find(
      (p) => pipeKey(p.venue, p.stop, p.pipeNo) === key && p.id !== editing?.id
    );
  }, [draft, pipes, editing]);

  const centsValid = isNumeric(draft.cents);
  const willFlag =
    (centsValid && Math.abs(Number(draft.cents)) > CENT_LIMIT) ||
    draft.reed === "abnormal";

  const liveReasons = anomalyReasons({
    pitch: draft.pitch,
    cents: centsValid ? Number(draft.cents) : 0,
    temperature: 0,
    humidity: 0,
    reed: draft.reed,
    reedNote: draft.reedNote,
    note: draft.note,
    at: "",
  });

  function validate(): boolean {
    const next: Partial<Record<keyof PipeDraft, string>> = {};
    if (!draft.venue.trim()) next.venue = "请选择或填写场馆";
    if (!draft.stop.trim()) next.stop = "请选择或填写音栓";
    if (!draft.pipeNo.trim()) next.pipeNo = "请填写音管编号";
    if (!draft.pitch.trim()) next.pitch = "请填写音高，如 A4";
    if (!isNumeric(draft.cents)) next.cents = "请填写音分偏差数字";
    if (!isNumeric(draft.temperature)) next.temperature = "请填写温度";
    if (!isNumeric(draft.humidity)) next.humidity = "请填写湿度";
    if (draft.reed === "abnormal" && !draft.reedNote.trim()) {
      next.reedNote = "簧片异常请写明现象";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSave() {
    setTried(true);
    if (!validate()) return;
    onSave(draft);
  }

  const inputClass = (key: keyof PipeDraft) =>
    tried && errors[key] ? "input invalid" : "input";

  return (
    <section className="panel form-panel">
      <div className="heading">
        <div>
          <p>现场录入</p>
          <h2>{editing ? `编辑音管 ${editing.pipeNo}` : "新增音管测量"}</h2>
        </div>
        {editing && (
          <button className="ghost" onClick={onCancelEdit}>
            取消编辑
          </button>
        )}
      </div>

      <div className="field-grid">
        <label>
          <span>场馆 *</span>
          <input
            className={inputClass("venue")}
            list="venue-options"
            placeholder="如 St.Mary 教堂"
            value={draft.venue}
            onChange={(e) => set("venue", e.target.value)}
          />
          <datalist id="venue-options">
            {venueNames.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </label>

        <label>
          <span>音栓 *</span>
          <input
            className={inputClass("stop")}
            list="stop-options"
            placeholder="如 Trumpet 8'"
            value={draft.stop}
            onChange={(e) => set("stop", e.target.value)}
          />
          <datalist id="stop-options">
            {stopsForVenue(draft.venue).map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>

        <label>
          <span>音管编号 *</span>
          <input
            className={inputClass("pipeNo")}
            placeholder="如 C#4"
            value={draft.pipeNo}
            disabled={!!editing}
            onChange={(e) => set("pipeNo", e.target.value)}
          />
        </label>

        <label>
          <span>音高 *</span>
          <input
            className={inputClass("pitch")}
            placeholder="如 C#4 / A4"
            value={draft.pitch}
            onChange={(e) => set("pitch", e.target.value)}
          />
        </label>

        <label>
          <span>音分偏差（cent）*</span>
          <input
            className={inputClass("cents")}
            type="number"
            step="0.1"
            placeholder="如 -12 或 +9"
            value={draft.cents}
            onChange={(e) => set("cents", e.target.value)}
          />
        </label>

        <div className="field-climate">
          <label>
            <span>温度（℃）*</span>
            <input
              className={inputClass("temperature")}
              type="number"
              step="0.1"
              placeholder="21.5"
              value={draft.temperature}
              onChange={(e) => set("temperature", e.target.value)}
            />
          </label>
          <label>
            <span>湿度（%）*</span>
            <input
              className={inputClass("humidity")}
              type="number"
              step="0.1"
              placeholder="45"
              value={draft.humidity}
              onChange={(e) => set("humidity", e.target.value)}
            />
          </label>
        </div>

        <div className="field-span">
          <span className="field-label">簧片状态 *</span>
          <div className="segmented">
            <button
              type="button"
              className={draft.reed === "ok" ? "seg active ok" : "seg"}
              onClick={() => set("reed", "ok" as ReedStatus)}
            >
              正常
            </button>
            <button
              type="button"
              className={draft.reed === "abnormal" ? "seg active bad" : "seg"}
              onClick={() => set("reed", "abnormal" as ReedStatus)}
            >
              异常
            </button>
          </div>
          {draft.reed === "abnormal" && (
            <input
              className={inputClass("reedNote") + " reed-note"}
              placeholder="说明簧片异常现象，如：簧舌磨损、杂音"
              value={draft.reedNote}
              onChange={(e) => set("reedNote", e.target.value)}
            />
          )}
        </div>

        <label className="field-span">
          <span>备注</span>
          <textarea
            className="input textarea"
            rows={2}
            placeholder="维修 / 巡检备注"
            value={draft.note}
            onChange={(e) => set("note", e.target.value)}
          />
        </label>
      </div>

      {tried && Object.keys(errors).length > 0 && (
        <p className="form-msg bad">
          请补全标红的必填项后再保存
          {errors.cents ? `（${errors.cents}）` : ""}
        </p>
      )}
      {duplicateOf && (
        <p className="form-msg warn">
          该音管已有档案：保存后当前值将更新，旧值进入修订记录（最多 3 版）
          {isPendingHint(duplicateOf) ? "，且目前处于待复检状态。" : "。"}
        </p>
      )}
      <p className={"form-msg " + (willFlag ? "bad" : "ok")}>
        {willFlag
          ? `本次录入将标记为待复检：${liveReasons.join("；")}`
          : `偏差在 ±${CENT_LIMIT} 音分内且簧片正常，保存后不产生待办。`}
      </p>

      <div className="form-actions">
        <button className="primary" onClick={handleSave}>
          {editing ? "保存更新" : duplicateOf ? "保存更新" : "保存测量"}
        </button>
      </div>
    </section>
  );
}

function isPendingHint(r: PipeRecord): boolean {
  return r.traces.some((t) => t.resolvedAt === null);
}
