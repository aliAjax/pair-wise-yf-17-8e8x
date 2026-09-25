/**
 * 领域逻辑层：异常判定、保存归档、复检、报告汇总等纯函数。
 * 不依赖 React，也不接触 localStorage。
 */
import type {
  AnomalyTrace,
  Measurement,
  PipeDraft,
  PipeRecord,
  SaveOutcome,
} from "./types";

/** 偏差绝对值超过该阈值（音分）即需复检 */
export const CENT_LIMIT = 10;
/** 同一音管修订历史最多保留的版本数 */
export const MAX_REVISIONS = 3;

/** 生成短 ID（无需加密强度） */
export function uid(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  ).toUpperCase();
}

/** 编号比较用：去空白、转小写，但界面上保留首次录入的原样写法 */
export function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

/** 音管在同场馆 + 同音栓下的复合键 */
export function pipeKey(venue: string, stop: string, pipeNo: string): string {
  return `${normalizeKey(venue)}|${normalizeKey(stop)}|${normalizeKey(pipeNo)}`;
}

/** 计算一次测量触发的异常原因；无异常返回空数组 */
export function anomalyReasons(m: Measurement): string[] {
  const reasons: string[] = [];
  if (Math.abs(m.cents) > CENT_LIMIT) {
    reasons.push(`音分偏差 ${m.cents > 0 ? "+" : ""}${m.cents}cent（超过±${CENT_LIMIT}）`);
  }
  if (m.reed === "abnormal") {
    reasons.push(m.reedNote ? `簧片异常：${m.reedNote}` : "簧片异常");
  }
  return reasons;
}

/** 该测量值是否异常 */
export function isAnomalous(m: Measurement): boolean {
  return anomalyReasons(m).length > 0;
}

/** 音管当前是否仍有待复检项 */
export function isPending(r: PipeRecord): boolean {
  return r.traces.some((t) => t.resolvedAt === null);
}

/** 取当前待复检痕迹 */
export function openTrace(r: PipeRecord): AnomalyTrace | undefined {
  return r.traces.find((t) => t.resolvedAt === null);
}

function newTrace(m: Measurement): AnomalyTrace {
  return {
    id: uid(),
    reasons: anomalyReasons(m),
    note: m.note,
    measuredAt: m.at,
    resolvedAt: null,
  };
}

/**
 * 保存一次测量。
 * - 首次：建立音管档案，异常则同时生成待复检痕迹；
 * - 再次：当前值进入修订历史（最多 3 版，更旧的丢弃），新值成为当前值；
 * - 本次测量异常且不存在未闭合痕迹时，新增一条待复检痕迹；
 *   复查合格只能通过 resolvePending 显式结束，保存合格值不会自动关闭。
 */
export function saveMeasurement(
  records: PipeRecord[],
  draft: PipeDraft,
  at: string = new Date().toISOString()
): { records: PipeRecord[]; outcome: SaveOutcome } {
  const measurement: Measurement = {
    pitch: draft.pitch.trim(),
    cents: Number(draft.cents),
    temperature: Number(draft.temperature),
    humidity: Number(draft.humidity),
    reed: draft.reed,
    reedNote: draft.reedNote.trim(),
    note: draft.note.trim(),
    at,
  };

  const key = pipeKey(draft.venue, draft.stop, draft.pipeNo);
  const index = records.findIndex(
    (r) => pipeKey(r.venue, r.stop, r.pipeNo) === key
  );
  const flagged = isAnomalous(measurement);

  if (index === -1) {
    const record: PipeRecord = {
      id: uid(),
      venue: draft.venue.trim(),
      stop: draft.stop.trim(),
      pipeNo: draft.pipeNo.trim(),
      current: measurement,
      revisions: [],
      traces: flagged ? [newTrace(measurement)] : [],
    };
    return {
      records: [record, ...records],
      outcome: { record, created: true, newlyFlagged: flagged },
    };
  }

  const existing = records[index];
  const revisions = [existing.current, ...existing.revisions].slice(
    0,
    MAX_REVISIONS
  );
  const hasOpenTrace = existing.traces.some((t) => t.resolvedAt === null);
  const traces = [...existing.traces];
  if (flagged && !hasOpenTrace) {
    traces.unshift(newTrace(measurement));
  }

  const record: PipeRecord = { ...existing, current: measurement, revisions, traces };
  const next = records.slice();
  next[index] = record;
  return {
    records: next,
    outcome: {
      record,
      created: false,
      newlyFlagged: flagged && !hasOpenTrace,
    },
  };
}

/**
 * 复查合格：只结束当前待办（写入复检时间），痕迹本身保留。
 * 返回 null 表示没有待复检项。
 */
export function resolvePending(
  records: PipeRecord[],
  recordId: string,
  at: string = new Date().toISOString()
): PipeRecord[] | null {
  const index = records.findIndex((r) => r.id === recordId);
  if (index === -1) return null;
  const record = records[index];
  if (!isPending(record)) return null;

  const traces = record.traces.map((t) =>
    t.resolvedAt === null ? { ...t, resolvedAt: at } : t
  );
  const next = records.slice();
  next[index] = { ...record, traces };
  return next;
}

/** 数字转字符串时去掉多余的 0，如 21.50 -> "21.5" */
export function formatNumber(value: number): string {
  return Number.isFinite(value) ? String(Number(value.toFixed(2))) : "—";
}

/** 时间显示：YYYY-MM-DD HH:mm */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export interface PendingRow {
  record: PipeRecord;
  trace: AnomalyTrace;
}

/** 维护报告：当前待复检汇总，按场馆 -> 音栓分组 */
export interface PendingGroup {
  venue: string;
  stop: string;
  rows: PendingRow[];
}

export function buildPendingGroups(records: PipeRecord[]): PendingGroup[] {
  const rows: PendingRow[] = [];
  for (const record of records) {
    const trace = openTrace(record);
    if (trace) rows.push({ record, trace });
  }
  rows.sort(
    (a, b) =>
      a.record.venue.localeCompare(b.record.venue, "zh") ||
      a.record.stop.localeCompare(b.record.stop, "zh") ||
      naturalCompare(a.record.pipeNo, b.record.pipeNo)
  );

  const groups: PendingGroup[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && last.venue === row.record.venue && last.stop === row.record.stop) {
      last.rows.push(row);
    } else {
      groups.push({
        venue: row.record.venue,
        stop: row.record.stop,
        rows: [row],
      });
    }
  }
  return groups;
}

/** 曾出现异常、现已全部复检合格的音管（报告中用于保留异常痕迹） */
export function resolvedTraceRecords(records: PipeRecord[]): PipeRecord[] {
  return records
    .filter(
      (r) => r.traces.length > 0 && r.traces.every((t) => t.resolvedAt !== null)
    )
    .sort((a, b) => naturalCompare(a.pipeNo, b.pipeNo));
}

/** 带数字感知的编号排序，使 C2 排在 C10 之前 */
export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

/** 最近一次测量所处的温湿度（取最新保存的音管记录），用于表头指标 */
export function latestClimate(records: PipeRecord[]): Measurement | null {
  if (records.length === 0) return null;
  return records.reduce((latest, r) =>
    r.current.at > latest.current.at ? r : latest
  ).current;
}
