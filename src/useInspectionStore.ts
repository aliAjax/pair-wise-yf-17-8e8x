/**
 * 状态层：以 hook 形式封装巡检数据的读写，
 * 数据变化时同步到浏览器本地存档。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  naturalCompare,
  resolvePending,
  saveMeasurement,
} from "./domain";
import { clearStore, loadStore, saveStore } from "./storage";
import type { InspectionStore, PipeDraft, PipeRecord, SaveOutcome } from "./types";

export function useInspectionStore() {
  const [store, setStore] = useState<InspectionStore>(() => loadStore());
  const [persistError, setPersistError] = useState(false);
  // 始终保存最新记录，使保存/复检等动作可以在事件处理中同步完成纯计算
  const pipesRef = useRef<PipeRecord[]>(store.pipes);
  pipesRef.current = store.pipes;

  useEffect(() => {
    try {
      saveStore(store);
      setPersistError(false);
    } catch {
      setPersistError(true);
    }
  }, [store]);

  /** 保存一次测量；返回结果用于界面提示。纯计算先完成，再一次性写入状态。 */
  const savePipe = useCallback((draft: PipeDraft): SaveOutcome => {
    const result = saveMeasurement(pipesRef.current, draft);
    pipesRef.current = result.records;
    setStore((prev) => ({ ...prev, pipes: result.records }));
    return result.outcome;
  }, []);

  const resolve = useCallback((recordId: string) => {
    const next = resolvePending(pipesRef.current, recordId);
    if (!next) return;
    pipesRef.current = next;
    setStore((prev) => ({ ...prev, pipes: next }));
  }, []);

  const clearAll = useCallback(() => {
    clearStore();
    pipesRef.current = [];
    setStore({ pipes: [], version: 1 });
  }, []);

  /** 场馆列表（按名称排序，含每馆待复检数） */
  const venues = useMemo(() => {
    const map = new Map<string, { pending: number; total: number }>();
    for (const p of store.pipes) {
      const stat = map.get(p.venue) ?? { pending: 0, total: 0 };
      stat.total += 1;
      if (p.traces.some((t) => t.resolvedAt === null)) stat.pending += 1;
      map.set(p.venue, stat);
    }
    return [...map.entries()]
      .map(([name, stat]) => ({ name, ...stat }))
      .sort((a, b) => a.name.localeCompare(b.name, "zh"));
  }, [store.pipes]);

  /** 指定场馆下的音栓列表 */
  const stopsOf = useCallback(
    (venue: string) => {
      const set = new Set<string>();
      for (const p of store.pipes) {
        if (p.venue === venue) set.add(p.stop);
      }
      return [...set].sort((a, b) => naturalCompare(a, b));
    },
    [store.pipes]
  );

  return {
    pipes: store.pipes,
    venues,
    stopsOf,
    savePipe,
    resolve,
    clearAll,
    persistError,
  };
}
