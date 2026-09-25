// 本地存档层：所有记录只保存在当前浏览器的 localStorage 中，不做任何网络上报。
// 首次打开时写入一份示例场馆 / 音栓 / 音管，方便直接试用；之后一律读取本地数据。

import type { ArchiveData, PipeRecord, Stop, Venue } from "../types";
import { resolveRecheck, upsertMeasurement } from "../domain/inspection";

const STORAGE_KEY = "organ-inspection-archive-v1";

const seedTime = "2026-09-18T15:10:00.000Z";
const seedLater = "2026-09-20T09:30:00.000Z";
const seedResolved = "2026-09-20T09:45:00.000Z";

function buildSeed(): ArchiveData {
  const venues: Venue[] = [
    { id: "venue-st-mary", name: "圣玛丽教堂", kind: "church" },
    { id: "venue-hall-a", name: "A 音乐厅", kind: "hall" },
  ];

  const stops: Stop[] = [
    { id: "stop-trumpet-8", venueId: "venue-st-mary", name: "Trumpet 8'", category: "reed" },
    { id: "stop-principal-4", venueId: "venue-st-mary", name: "Principal 4'", category: "principal" },
    { id: "stop-bourdon-16", venueId: "venue-st-mary", name: "Bourdon 16'", category: "bass" },
    { id: "stop-mixture-iii", venueId: "venue-hall-a", name: "Mixture III", category: "mixture" },
    { id: "stop-gamba-8", venueId: "venue-hall-a", name: "Gamba 8'", category: "principal" },
  ];

  let pipes: PipeRecord[] = [];
  const add = (
    venueId: string,
    stopId: string,
    pipeNo: string,
    pitch: string,
    cents: number,
    temperature: number,
    humidity: number,
    reed: "normal" | "abnormal",
    note: string,
  ) => {
    const result = upsertMeasurement(
      pipes,
      venueId,
      stopId,
      { pipeNo, pitch, cents, temperature, humidity, reed, note },
      seedTime,
    );
    pipes = result.pipes;
  };

  add("venue-st-mary", "stop-trumpet-8", "17", "C#4", 9, 21.5, 46, "normal", "簧片微调后复测稳定");
  add("venue-st-mary", "stop-bourdon-16", "12", "F2", -12, 20.8, 52, "normal", "低音区偏慢，已调整配重，待复检");
  add("venue-st-mary", "stop-principal-4", "20", "G3", -3, 21.2, 45, "normal", "正常");
  add("venue-hall-a", "stop-gamba-8", "8", "C3", 4, 22.4, 40, "abnormal", "簧片有杂音，清洁后待复检");
  add("venue-hall-a", "stop-mixture-iii", "24", "B4", 2, 22.6, 41, "normal", "正常");

  // 示例：同一音管再次保存 —— 当前值已更新，旧值进入修订记录
  const revised = upsertMeasurement(
    pipes,
    "venue-st-mary",
    "stop-principal-4",
    { pipeNo: "20", pitch: "G3", cents: -1, temperature: 21.6, humidity: 44, reed: "normal", note: "微调后记录" },
    seedLater,
  );
  pipes = revised.pipes;

  // 示例：曾经异常、复查合格 —— 待办已结束，异常痕迹仍保留
  const wasFlagged = upsertMeasurement(
    pipes,
    "venue-hall-a",
    "stop-mixture-iii",
    { pipeNo: "15", pitch: "E4", cents: 14, temperature: 22.1, humidity: 43, reed: "normal", note: "首轮偏高" },
    seedTime,
  );
  pipes = wasFlagged.pipes;
  const corrected = upsertMeasurement(
    pipes,
    "venue-hall-a",
    "stop-mixture-iii",
    { pipeNo: "15", pitch: "E4", cents: 2, temperature: 22.3, humidity: 42, reed: "normal", note: "调整音塞后复测合格" },
    seedResolved,
  );
  pipes = resolveRecheck(corrected.pipes, corrected.pipe.id, seedResolved);

  return { version: 1, venues, stops, pipes };
}

function isValidArchive(data: unknown): data is ArchiveData {
  if (!data || typeof data !== "object") return false;
  const d = data as Partial<ArchiveData>;
  return (
    d.version === 1 &&
    Array.isArray(d.venues) &&
    Array.isArray(d.stops) &&
    Array.isArray(d.pipes) &&
    d.venues.every((v) => typeof v.id === "string" && typeof v.name === "string") &&
    d.stops.every((s) => typeof s.id === "string" && typeof s.venueId === "string" && typeof s.name === "string") &&
    d.pipes.every((p) => typeof p.id === "string" && Boolean(p.current))
  );
}

/** 读取本地存档；不存在时写入并返回示例数据；损坏时回退到示例数据 */
export function loadArchive(): ArchiveData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isValidArchive(parsed)) return parsed;
    }
  } catch {
    // 读取或解析失败则重建存档
  }
  const seed = buildSeed();
  saveArchive(seed);
  return seed;
}

export function saveArchive(data: ArchiveData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // 隐私模式或配额不足时仅本次会话生效
  }
}

export const ARCHIVE_STORAGE_KEY = STORAGE_KEY;
