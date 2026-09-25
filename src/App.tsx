import { useCallback, useMemo, useState } from "react";
import "./styles.css";
import { EntryForm } from "./components/EntryForm";
import { FilterPanel } from "./components/FilterPanel";
import { PipeList } from "./components/PipeList";
import { Report } from "./components/Report";
import { isAnomalous } from "./domain";
import type { PipeDraft, PipeRecord } from "./types";
import { useInspectionStore } from "./useInspectionStore";

type Tab = "inspect" | "report";

interface Toast {
  text: string;
  tone: "ok" | "warn" | "bad";
}

function App() {
  const {
    pipes,
    venues,
    stopsOf,
    savePipe,
    resolve,
    clearAll,
    persistError,
  } = useInspectionStore();

  const [tab, setTab] = useState<Tab>("inspect");
  const [venue, setVenue] = useState("");
  const [stop, setStop] = useState("");
  const [editing, setEditing] = useState<PipeRecord | null>(null);
  const [resetToken, setResetToken] = useState(0);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  const stops = useMemo(
    () => (venue ? stopsOf(venue) : []),
    [venue, stopsOf]
  );

  const pendingTotal = useMemo(
    () => pipes.filter((p) => p.traces.some((t) => t.resolvedAt === null)).length,
    [pipes]
  );

  const showToast = useCallback((t: Toast) => {
    setToast(t);
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const handleVenueChange = (name: string) => {
    setVenue(name);
    setStop("");
    setEditing(null);
  };

  const handleStopChange = (name: string) => {
    setStop(name);
    setEditing(null);
  };

  const handleSave = (draft: PipeDraft) => {
    const outcome = savePipe(draft);
    setVenue(outcome.record.venue);
    setStop(outcome.record.stop);
    setEditing(null);
    setFocusId(outcome.record.id);
    setResetToken((n) => n + 1);

    const { record, created, newlyFlagged } = outcome;
    if (newlyFlagged) {
      showToast({
        text: `${record.pipeNo} 已保存并标记为待复检`,
        tone: "bad",
      });
    } else if (created) {
      showToast({ text: `${record.pipeNo} 建档完成，测量正常`, tone: "ok" });
    } else if (isAnomalous(record.current)) {
      showToast({
        text: `${record.pipeNo} 当前值已更新，仍处于待复检状态`,
        tone: "warn",
      });
    } else {
      showToast({
        text: `${record.pipeNo} 当前值已更新，旧值进入修订记录`,
        tone: "ok",
      });
    }
  };

  const handleEdit = (record: PipeRecord) => {
    setVenue(record.venue);
    setStop(record.stop);
    setEditing(record);
    setTab("inspect");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleResolve = (recordId: string) => {
    resolve(recordId);
    const record = pipes.find((p) => p.id === recordId);
    showToast({
      text: record
        ? `${record.pipeNo} 复检合格，待办已结束（异常痕迹保留）`
        : "待办已结束",
      tone: "ok",
    });
  };

  /** 报告页点异常行：切到巡检页、选中对应场馆音栓、滚动高亮该音管 */
  const handleLocate = (record: PipeRecord) => {
    setTab("inspect");
    setVenue(record.venue);
    setStop(record.stop);
    setEditing(null);
    setFocusId(record.id);
  };

  const handleClearAll = () => {
    if (
      window.confirm(
        "将清空本机浏览器中的全部巡检记录，且无法恢复。确定继续吗？"
      )
    ) {
      clearAll();
      setVenue("");
      setStop("");
      setEditing(null);
      showToast({ text: "本地存档已清空", tone: "warn" });
    }
  };

  return (
    <main className="app">
      <header className="app-header">
        <div>
          <h1>管风琴调音巡检台</h1>
          <p>
            选定场馆与音栓，逐管录入音高、偏差、温湿度与簧片状态；
            超限或簧片异常自动标记待复检。记录仅保存在本浏览器。
          </p>
        </div>
        <button className="ghost danger" onClick={handleClearAll}>
          清空本地记录
        </button>
      </header>

      <nav className="tabs">
        <button
          className={tab === "inspect" ? "tab active" : "tab"}
          onClick={() => setTab("inspect")}
        >
          巡检录入
        </button>
        <button
          className={tab === "report" ? "tab active" : "tab"}
          onClick={() => setTab("report")}
        >
          维护报告
          {pendingTotal > 0 && <b className="tab-badge">{pendingTotal}</b>}
        </button>
      </nav>

      {persistError && (
        <div className="storage-warn">
          记录无法写入浏览器存储（可能处于隐私模式），刷新后数据会丢失。
        </div>
      )}

      {tab === "inspect" ? (
        <>
          <div className="workspace">
            <FilterPanel
              venues={venues}
              stops={stops}
              venue={venue}
              stop={stop}
              pipes={pipes}
              onVenueChange={handleVenueChange}
              onStopChange={handleStopChange}
            />
            <EntryForm
              pipes={pipes}
              venueNames={venues.map((v) => v.name)}
              stopsForVenue={stopsOf}
              selectedVenue={venue}
              selectedStop={stop}
              editing={editing}
              resetToken={resetToken}
              onSave={handleSave}
              onCancelEdit={() => setEditing(null)}
            />
          </div>
          <PipeList
            pipes={pipes}
            venue={venue}
            stop={stop}
            focusId={focusId}
            onEdit={handleEdit}
            onResolve={handleResolve}
            onFocusHandled={() => setFocusId(null)}
          />
        </>
      ) : (
        <Report pipes={pipes} onLocate={handleLocate} />
      )}

      <footer className="app-footer">
        所有数据仅存于浏览器 localStorage，不上传服务器；清空浏览器站点数据会一并删除记录。
      </footer>

      {toast && (
        <div className={"toast toast-" + toast.tone} role="status">
          {toast.text}
        </div>
      )}
    </main>
  );
}

export default App;
