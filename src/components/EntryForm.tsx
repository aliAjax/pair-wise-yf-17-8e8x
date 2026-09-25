import { useState } from "react";
import type { MeasurementInput, PipeRecord, ReedStatus } from "../types";
import { CENTS_LIMIT, reedLabels } from "../domain/inspection";

interface EntryFormProps {
  /** 当前音栓下的全部音管，用于提示编号将触发更新而非新建 */
  pipes: PipeRecord[];
  /** 进入录入前点选“编辑”的音管；表单以其当前值预填 */
  editingPipe: PipeRecord | undefined;
  onSave: (input: MeasurementInput) => { flagged: boolean; isNew: boolean };
  onCancelEdit: () => void;
}

const EMPTY = {
  pipeNo: "",
  pitch: "",
  cents: "",
  temperature: "",
  humidity: "",
  reed: "normal" as ReedStatus,
  note: "",
};

export function EntryForm({ pipes, editingPipe, onSave, onCancelEdit }: EntryFormProps) {
  const existingPipe = editingPipe;
  const [form, setForm] = useState(() =>
    editingPipe
      ? {
          pipeNo: editingPipe.pipeNo,
          pitch: editingPipe.current.pitch,
          cents: String(editingPipe.current.cents),
          temperature: String(editingPipe.current.temperature),
          humidity: String(editingPipe.current.humidity),
          reed: editingPipe.current.reed,
          note: editingPipe.current.note,
        }
      : { ...EMPTY },
  );
  const [error, setError] = useState<string | null>(null);

  const dup = !editingPipe
    ? pipes.find((p) => p.pipeNo === form.pipeNo.trim())
    : undefined;
  const duplicateNo = dup ? dup.pipeNo : null;

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function submit() {
    const cents = Number(form.cents);
    const temperature = Number(form.temperature);
    const humidity = Number(form.humidity);
    if (!form.pipeNo.trim()) return setError("请填写音管编号");
    if (!form.pitch.trim()) return setError("请填写音高，如 F2、C#4");
    if (form.cents.trim() === "" || !Number.isFinite(cents)) return setError("请填写音分偏差（整数或小数，可为负）");
    if (form.temperature.trim() === "" || !Number.isFinite(temperature)) return setError("请填写温度（℃）");
    if (form.humidity.trim() === "" || !Number.isFinite(humidity)) return setError("请填写湿度（%）");

    const result = onSave({
      pipeNo: form.pipeNo.trim(),
      pitch: form.pitch.trim(),
      cents,
      temperature,
      humidity,
      reed: form.reed,
      note: form.note,
    });
    // 无论新增还是更新，保存后表单清空；继续更新可再点音管行的“编辑”
    setForm({ ...EMPTY });
    setError(null);
    return result;
  }

  return (
    <section className="panel entry-panel">
      <div className="heading">
        <div>
          <p>现场录入</p>
          <h2>{existingPipe ? `复检 / 更新 第 ${existingPipe.pipeNo} 号音管` : "音管测量录入"}</h2>
        </div>
        {existingPipe && (
          <button type="button" className="ghost" onClick={onCancelEdit}>
            取消编辑
          </button>
        )}
      </div>

      {existingPipe && (
        <p className="edit-hint">
          正在更新已建档音管：保存后当前值被替换，原读数自动进入修订记录（保留最近 3 版）。
        </p>
      )}

      <div className="field-grid">
        <label>
          <span>音管编号 *</span>
          <input
            placeholder="如 12"
            value={form.pipeNo}
            onChange={(e) => update("pipeNo", e.target.value)}
          />
        </label>
        <label>
          <span>音高 *</span>
          <input
            placeholder="如 F2、C#4"
            value={form.pitch}
            onChange={(e) => update("pitch", e.target.value)}
          />
        </label>
        <label>
          <span>音分偏差（cent）*</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            placeholder="如 -12 或 9"
            value={form.cents}
            onChange={(e) => update("cents", e.target.value)}
            className={form.cents !== "" && Math.abs(Number(form.cents)) > CENTS_LIMIT ? "input-danger" : ""}
          />
        </label>
        <label>
          <span>温度（℃）*</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            placeholder="如 21.5"
            value={form.temperature}
            onChange={(e) => update("temperature", e.target.value)}
          />
        </label>
        <label>
          <span>湿度（%）*</span>
          <input
            type="number"
            inputMode="decimal"
            step="1"
            placeholder="如 46"
            value={form.humidity}
            onChange={(e) => update("humidity", e.target.value)}
          />
        </label>
        <fieldset className="reed-field">
          <legend>簧片状态</legend>
          <div className="reed-options">
            {(["normal", "abnormal"] as ReedStatus[]).map((status) => (
              <label key={status} className={`reed-choice ${status === "abnormal" ? "danger" : ""}`}>
                <input
                  type="radio"
                  name="reed-status"
                  checked={form.reed === status}
                  onChange={() => update("reed", status)}
                />
                {reedLabels[status]}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <label className="full-field">
        <span>维修 / 巡检备注</span>
        <textarea
          rows={2}
          placeholder="如：低音区偏慢，已调整配重"
          value={form.note}
          onChange={(e) => update("note", e.target.value)}
        />
      </label>

      {duplicateNo && !existingPipe && (
        <p className="hint-warn">
          该编号已存在时保存将更新原音管（旧值进入修订记录），不会新建重复档案。
        </p>
      )}
      {error && <p className="form-error">{error}</p>}

      <div className="form-actions">
        <button type="button" className="primary" onClick={submit}>
          保存本次测量
        </button>
        <span className="rule-note">
          规则：偏差绝对值 &gt; {CENTS_LIMIT} 音分或簧片异常 → 自动标为待复检
        </span>
      </div>
    </section>
  );
}
