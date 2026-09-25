/**
 * 数据类型层：管风琴巡检台用到的所有领域数据结构。
 * 本文件只描述数据形状，不涉及存档与界面。
 */

/** 簧片状态：正常 / 异常（需要描述具体现象） */
export type ReedStatus = "ok" | "abnormal";

/** 一次调音测量值。音管当前值与修订历史中的旧版都使用该结构。 */
export interface Measurement {
  /** 音高，如 A4、C#4 */
  pitch: string;
  /** 音分偏差（cent），可正可负，绝对值 > 10 视为偏差超限 */
  cents: number;
  /** 温度（℃） */
  temperature: number;
  /** 相对湿度（%） */
  humidity: number;
  reed: ReedStatus;
  /** 簧片异常时的具体说明 */
  reedNote: string;
  /** 维修 / 巡检备注 */
  note: string;
  /** ISO 时间字符串，记录保存时刻 */
  at: string;
}

/** 异常痕迹：因偏差超限或簧片异常被标记为待复检的历史，不随复查删除 */
export interface AnomalyTrace {
  id: string;
  reasons: string[];
  note: string;
  /** 触发异常时的测量时间 */
  measuredAt: string;
  /** 复检合格时间；null 表示仍待复检 */
  resolvedAt: string | null;
}

/** 一根音管的巡检档案 */
export interface PipeRecord {
  id: string;
  venue: string;
  stop: string;
  /** 音管编号，同一场馆+音栓下唯一 */
  pipeNo: string;
  current: Measurement;
  /** 旧版测量值，最多保留 3 版，最新的旧版排在最前 */
  revisions: Measurement[];
  /** 异常痕迹（含已复检与待复检），最新在前 */
  traces: AnomalyTrace[];
}

/** localStorage 中保存的整体存档 */
export interface InspectionStore {
  pipes: PipeRecord[];
  /** 数据结构版本，便于以后迁移 */
  version: 1;
}

/** 录入表单草稿（界面层使用） */
export interface PipeDraft {
  venue: string;
  stop: string;
  pipeNo: string;
  pitch: string;
  cents: string;
  temperature: string;
  humidity: string;
  reed: ReedStatus;
  reedNote: string;
  note: string;
}

/** 保存动作的结果，供界面提示使用 */
export interface SaveOutcome {
  record: PipeRecord;
  /** true 表示这是该音管第一次建档 */
  created: boolean;
  /** true 表示本次保存新建了一条待复检痕迹 */
  newlyFlagged: boolean;
}
