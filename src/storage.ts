/**
 * 本地存档层：数据只保存在浏览器 localStorage 中，不向任何服务器发送。
 * 读取时做一次清洗，避免历史脏数据导致界面崩溃。
 */
import { MAX_REVISIONS } from "./domain";
import type { InspectionStore, Measurement, PipeRecord, ReedStatus } from "./types";

const STORAGE_KEY = "organ-tuning-inspection:v1";

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function sanitizeMeasurement(value: unknown): Measurement | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  const reed: ReedStatus = v.reed === "abnormal" ? "abnormal" : "ok";
  return {
    pitch: asString(v.pitch),
    cents: asNumber(v.cents),
    temperature: asNumber(v.temperature),
    humidity: asNumber(v.humidity),
    reed,
    reedNote: asString(v.reedNote),
    note: asString(v.note),
    at: asString(v.at, new Date(0).toISOString()),
  };
}

function sanitizeRecord(value: unknown): PipeRecord | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  const venue = asString(v.venue).trim();
  const stop = asString(v.stop).trim();
  const pipeNo = asString(v.pipeNo).trim();
  const current = sanitizeMeasurement(v.current);
  if (!venue || !stop || !pipeNo || !current) return null;

  const revisions = Array.isArray(v.revisions)
    ? (v.revisions as unknown[])
        .map(sanitizeMeasurement)
        .filter((m): m is Measurement => m !== null)
        .slice(0, MAX_REVISIONS)
    : [];

  const traces = Array.isArray(v.traces)
    ? (v.traces as unknown[])
        .map((t) => {
          if (typeof t !== "object" || t === null) return null;
          const tv = t as Record<string, unknown>;
          return {
            id: asString(tv.id),
            reasons: Array.isArray(tv.reasons)
              ? (tv.reasons as unknown[]).map((x) => asString(x))
              : [],
            note: asString(tv.note),
            measuredAt: asString(tv.measuredAt),
            resolvedAt:
              typeof tv.resolvedAt === "string" ? tv.resolvedAt : null,
          };
        })
        .filter((t): t is NonNullable<typeof t> => t !== null && t.id !== "")
    : [];

  return {
    id: asString(v.id),
    venue,
    stop,
    pipeNo,
    current,
    revisions,
    traces,
  };
}

export function emptyStore(): InspectionStore {
  return { pipes: [], version: 1 };
}

/** 从浏览器读取存档；任何异常都回退为空存档 */
export function loadStore(): InspectionStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Partial<InspectionStore>;
    const pipes = Array.isArray(parsed.pipes)
      ? (parsed.pipes as unknown[])
          .map(sanitizeRecord)
          .filter((r): r is PipeRecord => r !== null)
      : [];
    return { pipes, version: 1 };
  } catch {
    return emptyStore();
  }
}

/** 写入存档；写入失败（隐私模式等）时抛出由调用方提示 */
export function saveStore(store: InspectionStore): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function clearStore(): void {
  localStorage.removeItem(STORAGE_KEY);
}
