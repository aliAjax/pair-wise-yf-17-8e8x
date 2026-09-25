import { useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";
import { useInspectionStore } from "./hooks/useInspectionStore";
import { CENTS_LIMIT, openAnomaly, pipesOfStop, reasonLabels } from "./domain/inspection";
import type { PipeRecord } from "./types";
import { SelectorBar } from "./components/SelectorBar";
import { EntryForm } from "./components/EntryForm";
import { PipeTable } from "./components/PipeTable";
import { ReportView } from "./components/ReportView";
import { ARCHIVE_STORAGE_KEY } from "./storage/archive";
import { formatDateTime } from "./utils/format";

type TabKey = "inspection" | "report";

export default function App() {
  const store = useInspectionStore();
  const { venues, stops, pipes } = store;

  const [venueId, setVenueId] = useState<string | null>(venues[0]?.id ?? null);
  const [stopId, setStopId] = useState<string | null>(
    () => stops.find((s) => s.venueId === venues[0]?.id)?.id ?? null,
  );
  const [tab, setTab] = useState<TabKey>("inspection");
  const [editingPipeId, setEditingPipeId] = useState<string | null>(null);
  const [locate, setLocate] = useState<{ pipeId: string; nonce: number } | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: "ok" | "warn" } | null>(null);

  const listTopRef = useRef<HTMLDivElement | null>(null);

  const venue = venues.find((v) => v.id === venueId);
  const stop = stops.find((s) => s.id === stopId && s.venueId === venueId);
  const stopPipes = useMemo(
    () => (stopId ? pipesOfStop(pipes, stopId) : []),
    [pipes, stopId],
  );

  const pendingTotal = useMemo(() => pipes.filter((p) => p.pending).length, [pipes]);

  const archiveData = useMemo(() => ({ version: 1 as const, venues, stops, pipes }), [venues, stops, pipes]);

  // 最新环境读数（当前场馆内最近一次保存）
  const latestEnv = useMemo(() => {
    const venuePipes = pipes.filter((p) => p.venueId === venueId);
    if (venuePipes.length === 0) return null;
    return [...venuePipes].sort((a, b) => b.current.savedAt.localeCompare(a.current.savedAt))[0].current;
  }, [pipes, venueId]);

  function showToast(text: string, tone: "ok" | "warn" = "ok") {
    setToast({ text, tone });
  }

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function handleVenueChange(nextVenueId: string) {
    setVenueId(nextVenueId);
    const firstStop = stops.find((s) => s.venueId === nextVenueId);
    setStopId(firstStop?.id ?? null);
    setEditingPipeId(null);
  }

  function handleAddVenue(name: string, kind: "church" | "hall") {
    const v = store.addVenue(name, kind);
    handleVenueChange(v.id);
    showToast(`已添加场馆「${v.name}」`);
  }

  function handleAddStop(name: string, category: Parameters<typeof store.addStop>[2]) {
    if (!venueId) return;
    const s = store.addStop(venueId, name, category);
    setStopId(s.id);
    setEditingPipeId(null);
    showToast(`已添加音栓「${s.name}」`);
  }

  function handleSave(input: Parameters<typeof store.saveMeasurement>[2]) {
    if (!venueId || !stopId) {
      showToast("请先选择场馆和音栓", "warn");
      return { flagged: false, isNew: false };
    }
    const result = store.saveMeasurement(venueId, stopId, input);
    if (result.flagged) {
      const reasons = openAnomaly(result.pipe)?.reasons ?? [];
      showToast(
        `第 ${input.pipeNo} 号已保存并标记待复检（${reasons.map((r) => reasonLabels[r]).join("、")}）`,
        "warn",
      );
    } else {
      showToast(`第 ${input.pipeNo} 号测量已保存`);
    }
    // 保存后表单复位为“新增”状态；需要继续更新可再点该行的“编辑”
    setEditingPipeId(null);
    return { flagged: result.flagged, isNew: result.isNew };
  }

  function handleResolve(pipe: PipeRecord) {
    if (!window.confirm(`确认第 ${pipe.pipeNo} 号音管复查合格？\n将结束待办，原异常痕迹会保留在档案中。`)) return;
    store.resolvePipe(pipe.id);
    showToast(`第 ${pipe.pipeNo} 号已结束待复检，异常痕迹已留档`);
  }

  function handleDelete(pipe: PipeRecord) {
    if (!window.confirm(`确认删除第 ${pipe.pipeNo} 号音管的全部档案？此操作不可恢复。`)) return;
    store.deletePipe(pipe.id);
    if (editingPipeId === pipe.id) setEditingPipeId(null);
    showToast(`第 ${pipe.pipeNo} 号档案已删除`, "warn");
  }

  function handleEdit(pipe: PipeRecord) {
    setEditingPipeId(pipe.id);
    listTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // 从报告点异常行：切到巡检台、选中所属场馆 / 音栓并定位高亮
  function handleLocate(pipe: PipeRecord) {
    setVenueId(pipe.venueId);
    setStopId(pipe.stopId);
    setTab("inspection");
    setLocate({ pipeId: pipe.id, nonce: Date.now() });
  }

  // 定位时展开目标行并滚动到视口（展开动作通过自定义事件交给 PipeTable）
  useEffect(() => {
    if (!locate || tab !== "inspection") return;
    const scroll = window.setTimeout(() => {
      const rows = document.querySelectorAll<HTMLElement>("[data-pipe-id]");
      const el = [...rows].find((node) => node.dataset.pipeId === locate.pipeId) ?? null;
      if (!el) return;
      window.dispatchEvent(new CustomEvent("organ:locate", { detail: { pipeId: locate.pipeId } }));
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
    // 高亮动画结束后移除标记，便于再次定位时重新播放
    const clear = window.setTimeout(() => setLocate((cur) => (cur?.nonce === locate.nonce ? null : cur)), 2600);
    return () => {
      window.clearTimeout(scroll);
      window.clearTimeout(clear);
    };
  }, [locate, tab, stopPipes.length]);

  const editingPipe = editingPipeId ? pipes.find((p) => p.id === editingPipeId) : undefined;

  return (
    <main className="app">
      <header className="app-header">
        <div>
          <p className="eyebrow">管风琴现场巡检台</p>
          <h1>音管调音与复检记录</h1>
          <span className="subtitle">
            选定场馆与音栓，逐管录入音高、音分偏差、温湿度、簧片状态与备注；偏差超 {CENTS_LIMIT} 音分或簧片异常自动标记待复检。
          </span>
        </div>
        <div className="local-badge" title={ARCHIVE_STORAGE_KEY}>
          <span className="dot" />
          记录仅保存在本浏览器
          <small>localStorage · 无网络上报</small>
        </div>
      </header>

      <section className="metrics">
        <article>
          <small>音栓数量（当前场馆）</small>
          <strong>{venueId ? stops.filter((s) => s.venueId === venueId).length : 0}</strong>
        </article>
        <article className={pendingTotal > 0 ? "metric-danger" : ""}>
          <small>待复检音管（全部场馆）</small>
          <strong>{pendingTotal}</strong>
        </article>
        <article>
          <small>最近温度读数</small>
          <strong>{latestEnv ? `${latestEnv.temperature}℃` : "—"}</strong>
        </article>
        <article>
          <small>最近湿度读数</small>
          <strong>{latestEnv ? `${latestEnv.humidity}%` : "—"}</strong>
          {latestEnv && <time>{formatDateTime(latestEnv.savedAt)}</time>}
        </article>
      </section>

      <SelectorBar
        venues={venues}
        stops={stops}
        venueId={venueId}
        stopId={stopId}
        showStopSelector={tab === "inspection"}
        onVenueChange={handleVenueChange}
        onStopChange={(id) => {
          setStopId(id);
          setEditingPipeId(null);
        }}
        onAddVenue={handleAddVenue}
        onAddStop={handleAddStop}
      />

      <nav className="tabs no-print">
        <button
          type="button"
          className={tab === "inspection" ? "tab active" : "tab"}
          onClick={() => setTab("inspection")}
        >
          巡检录入
        </button>
        <button
          type="button"
          className={tab === "report" ? "tab active" : "tab"}
          onClick={() => setTab("report")}
        >
          维护报告{pendingTotal > 0 && <span className="tab-badge">{pendingTotal}</span>}
        </button>
      </nav>

      {tab === "inspection" && (
        <div ref={listTopRef} className="workspace">
          <EntryForm
            key={`${stopId ?? "none"}::${editingPipe?.id ?? "new"}`}
            pipes={stopPipes}
            editingPipe={editingPipe}
            onSave={handleSave}
            onCancelEdit={() => setEditingPipeId(null)}
          />
          <PipeTable
            stop={stop}
            pipes={stopPipes}
            locatePipeId={locate?.pipeId ?? null}
            onEdit={handleEdit}
            onResolve={handleResolve}
            onDelete={handleDelete}
          />
        </div>
      )}

      {tab === "report" && (
        <ReportView
          data={archiveData}
          venue={venue}
          stopNameOf={(id) => stops.find((s) => s.id === id)?.name ?? "未知音栓"}
          onLocate={handleLocate}
        />
      )}

      <footer className="app-footer no-print">
        数据结构（src/types.ts）、本地存档（src/storage）与界面（src/components）分层组织；清除浏览器站点数据将同时删除记录。
      </footer>

      {toast && <div className={`toast ${toast.tone === "warn" ? "warn" : ""}`}>{toast.text}</div>}
    </main>
  );
}
