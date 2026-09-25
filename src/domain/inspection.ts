// 业务规则层：偏差判定、修订留版、待复检与异常痕迹等规则都集中在这里，
// 不依赖 localStorage，也不依赖 React，方便单独理解和测试。

import type {
  AnomalyTrace,
  ArchiveData,
  FlagReason,
  Measurement,
  MeasurementInput,
  PipeRecord,
  ReedStatus,
  Revision,
  StopCategory,
  VenueKind,
} from "../types";

/** 音分偏差绝对值超过该阈值即待复检 */
export const CENTS_LIMIT = 10;

export const reedLabels: Record<ReedStatus, string> = {
  normal: "正常",
  abnormal: "异常",
};

export const reasonLabels: Record<FlagReason, string> = {
  "cents-overlimit": `偏差超 ${CENTS_LIMIT} 音分`,
  "reed-abnormal": "簧片异常",
};

export const categoryLabels: Record<StopCategory, string> = {
  principal: "主音栓",
  reed: "簧片音栓",
  mixture: "混合音栓",
  bass: "低音管",
};

export const venueKindLabels: Record<VenueKind, string> = {
  church: "教堂",
  hall: "音乐厅",
};

/** 由场馆 + 音栓 + 编号组成音管档案的稳定标识 */
export function pipeIdOf(venueId: string, stopId: string, pipeNo: string): string {
  return `${venueId}::${stopId}::${pipeNo.trim()}`;
}

/** 依据当前读数计算异常原因；无异常返回空数组 */
export function detectReasons(cents: number, reed: ReedStatus): FlagReason[] {
  const reasons: FlagReason[] = [];
  if (Math.abs(cents) > CENTS_LIMIT) reasons.push("cents-overlimit");
  if (reed === "abnormal") reasons.push("reed-abnormal");
  return reasons;
}

function createId(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${rand}`;
}

export function createVenueId(): string {
  return createId("venue");
}

export function createStopId(): string {
  return createId("stop");
}

function toMeasurement(input: MeasurementInput, savedAt: string): Measurement {
  return {
    pitch: input.pitch.trim(),
    cents: input.cents,
    temperature: input.temperature,
    humidity: input.humidity,
    reed: input.reed,
    note: input.note.trim(),
    savedAt,
  };
}

function toRevision(prev: Measurement, reasons: FlagReason[]): Revision {
  return {
    id: createId("rev"),
    ...prev,
    flagged: reasons.length > 0,
    reasons,
  };
}

/**
 * 录入 / 再次保存同一根音管：
 * - 同一音管再保存时当前值更新，旧值压入修订记录（最多 3 版）；
 * - |偏差| > 10 音分或簧片异常 => 待复检，并登记 / 刷新异常痕迹；
 * - 读数正常不自动销项，待复检只能通过“复查合格”结束。
 * 返回（可能为新的）音管档案；pipeId 已存在时替换原档案。
 */
export function upsertMeasurement(
  pipes: PipeRecord[],
  venueId: string,
  stopId: string,
  input: MeasurementInput,
  now: string,
): { pipes: PipeRecord[]; pipe: PipeRecord; isNew: boolean; flagged: boolean } {
  const id = pipeIdOf(venueId, stopId, input.pipeNo);
  const existing = pipes.find((p) => p.id === id);
  const reasons = detectReasons(input.cents, input.reed);
  const flagged = reasons.length > 0;
  const measurement = toMeasurement(input, now);

  if (!existing) {
    const anomalies: AnomalyTrace[] = flagged
      ? [
          {
            id: createId("anm"),
            reasons,
            openedAt: now,
            lastObservedAt: now,
            resolvedAt: null,
            pitch: measurement.pitch,
            cents: measurement.cents,
            reed: measurement.reed,
            note: measurement.note,
          },
        ]
      : [];
    const pipe: PipeRecord = {
      id,
      venueId,
      stopId,
      pipeNo: input.pipeNo.trim(),
      current: measurement,
      revisions: [],
      anomalies,
      pending: flagged,
      createdAt: now,
      updatedAt: now,
    };
    return { pipes: [...pipes, pipe], pipe, isNew: true, flagged };
  }

  // 同一音管再保存：旧当前值进入修订记录，最多保留三版
  const revisions = [toRevision(existing.current, detectReasons(existing.current.cents, existing.current.reed)), ...existing.revisions].slice(0, 3);

  let anomalies = existing.anomalies;
  let pending = existing.pending;
  if (flagged) {
    const open = existing.anomalies.find((a) => a.resolvedAt === null);
    if (open) {
      // 待复检期间再次测得异常：刷新最近观测，不新增痕迹
      anomalies = existing.anomalies.map((a) =>
        a.id === open.id
          ? {
              ...a,
              reasons,
              lastObservedAt: now,
              pitch: measurement.pitch,
              cents: measurement.cents,
              reed: measurement.reed,
              note: measurement.note,
            }
          : a,
      );
    } else {
      // 老痕迹已销项后再次异常：新增一条，原痕迹保留
      anomalies = [
        ...existing.anomalies,
        {
          id: createId("anm"),
          reasons,
          openedAt: now,
          lastObservedAt: now,
          resolvedAt: null,
          pitch: measurement.pitch,
          cents: measurement.cents,
          reed: measurement.reed,
          note: measurement.note,
        },
      ];
    }
    pending = true;
  }

  const updated: PipeRecord = {
    ...existing,
    current: measurement,
    revisions,
    anomalies,
    pending,
    updatedAt: now,
  };
  return {
    pipes: pipes.map((p) => (p.id === id ? updated : p)),
    pipe: updated,
    isNew: false,
    flagged,
  };
}

/** 复查合格：只结束待办，读数与全部异常痕迹（标记为已处理）原样留档 */
export function resolveRecheck(pipes: PipeRecord[], pipeId: string, now: string): PipeRecord[] {
  return pipes.map((p) => {
    if (p.id !== pipeId || !p.pending) return p;
    return {
      ...p,
      pending: false,
      anomalies: p.anomalies.map((a) => (a.resolvedAt === null ? { ...a, resolvedAt: now } : a)),
    };
  });
}

/** 某音栓下的全部音管，按编号自然排序（C2 在 C10 前） */
export function pipesOfStop(pipes: PipeRecord[], stopId: string): PipeRecord[] {
  return pipes.filter((p) => p.stopId === stopId).sort(comparePipeNo);
}

/** 某场馆下待复检的音管，按音栓名 + 编号排序 */
export function pendingPipesOfVenue(data: ArchiveData, venueId: string): PipeRecord[] {
  return data.pipes
    .filter((p) => p.venueId === venueId && p.pending)
    .sort((a, b) => {
      const stopDiff = (data.stops.find((s) => s.id === a.stopId)?.name ?? "").localeCompare(
        data.stops.find((s) => s.id === b.stopId)?.name ?? "",
        "zh-Hans-CN",
      );
      return stopDiff !== 0 ? stopDiff : comparePipeNo(a, b);
    });
}

/** 编号自然排序：数字按数值比较，其余按字符串比较 */
export function comparePipeNo(a: PipeRecord, b: PipeRecord): number {
  const na = Number(a.pipeNo);
  const nb = Number(b.pipeNo);
  if (a.pipeNo.trim() !== "" && b.pipeNo.trim() !== "" && Number.isFinite(na) && Number.isFinite(nb)) {
    return na - nb;
  }
  return a.pipeNo.localeCompare(b.pipeNo, "zh-Hans-CN", { numeric: true, sensitivity: "base" });
}

/** 取音管当前未处理的异常（正常情况下最多一条） */
export function openAnomaly(pipe: PipeRecord): AnomalyTrace | undefined {
  return pipe.anomalies.find((a) => a.resolvedAt === null);
}

/** 带符号的音分偏差展示，如 +9、-12 */
export function formatCents(cents: number): string {
  return cents > 0 ? `+${cents}` : String(cents);
}
