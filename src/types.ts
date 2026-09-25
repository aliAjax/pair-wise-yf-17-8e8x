// 数据类型层：管风琴巡检台涉及的全部记录结构，只描述数据，不含任何存取或界面逻辑。

/** 簧片状态 */
export type ReedStatus = "normal" | "abnormal";

/** 场馆类型 */
export type VenueKind = "church" | "hall";

/** 音栓分类 */
export type StopCategory = "principal" | "reed" | "mixture" | "bass";

/** 触发待复检的原因 */
export type FlagReason = "cents-overlimit" | "reed-abnormal";

/** 场馆（教堂 / 音乐厅） */
export interface Venue {
  id: string;
  name: string;
  kind: VenueKind;
}

/** 音栓，归属于某个场馆 */
export interface Stop {
  id: string;
  venueId: string;
  name: string;
  category: StopCategory;
}

/** 一次完整测量值（音管当前值或某一版修订值的公共部分） */
export interface Measurement {
  /** 音高，如 F2、C#4 */
  pitch: string;
  /** 音分偏差，如 -12 表示偏低 12 音分 */
  cents: number;
  /** 温度 ℃ */
  temperature: number;
  /** 湿度 % */
  humidity: number;
  /** 簧片状态 */
  reed: ReedStatus;
  /** 维修 / 巡检备注 */
  note: string;
  /** 本次测量保存时间（ISO 字符串） */
  savedAt: string;
}

/** 表单录入的测量内容（编号与测量值，时间由系统补） */
export interface MeasurementInput {
  pipeNo: string;
  pitch: string;
  cents: number;
  temperature: number;
  humidity: number;
  reed: ReedStatus;
  note: string;
}

/** 修订记录：保存时被替换下来的旧值，最多保留 3 版 */
export interface Revision extends Measurement {
  id: string;
  /** 该旧值在其任内是否曾触发异常 */
  flagged: boolean;
  reasons: FlagReason[];
}

/** 异常痕迹：一旦产生就长期保留，复查合格只把状态改为已处理 */
export interface AnomalyTrace {
  id: string;
  reasons: FlagReason[];
  /** 首次发现时间 */
  openedAt: string;
  /** 最近一次异常观测时间（待复检期间重复保存异常值时更新） */
  lastObservedAt: string;
  /** 复查合格时间，null 表示仍待复检 */
  resolvedAt: string | null;
  /** 发现时（或最近观测）的读数快照 */
  pitch: string;
  cents: number;
  reed: ReedStatus;
  note: string;
}

/** 一根音管的完整档案 */
export interface PipeRecord {
  id: string;
  venueId: string;
  stopId: string;
  /** 音管编号，同一音栓内唯一 */
  pipeNo: string;
  /** 当前值 */
  current: Measurement;
  /** 旧值修订记录，最新在前，最多 3 版 */
  revisions: Revision[];
  /** 异常痕迹，全部保留（含已复查合格的） */
  anomalies: AnomalyTrace[];
  /** 是否待复检 */
  pending: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 浏览器本地存档的整体结构 */
export interface ArchiveData {
  version: 1;
  venues: Venue[];
  stops: Stop[];
  pipes: PipeRecord[];
}
