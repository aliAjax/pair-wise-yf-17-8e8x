import { useMemo, useState } from "react";
import {
  CENT_LIMIT,
  MAX_REVISIONS,
  formatNumber,
  formatTime,
  isAnomalous,
  isPending,
  naturalCompare,
} from "../domain";
import type { PipeRecord } from "../types";

interface PipeListProps {
  pipes: PipeRecord[];
  venue: string;
  stop: string;
  /** 报告页定位过来的音管 id */
  focusId: string | null;
  onEdit: (record: PipeRecord) => void;
  onResolve: (recordId: string) => void;
  onFocusHandled: () => void;
}

export function PipeList({
  pipes,
  venue,
  stop,
  focusId,
  onEdit,
  onResolve,
  onFocusHandled,
}: PipeListProps) {
  const [onlyPending, setOnlyPending] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  const list = useMemo(() => {
    let result = pipes;
    if (venue) result = result.filter((p) => p.venue === venue);
    if (stop) result = result.filter((p) => p.stop === stop);
    if (onlyPending) result = result.filter(isPending);
    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (p) =>
          p.pipeNo.toLowerCase().includes(q) ||
          p.current.pitch.toLowerCase().includes(q) ||
          p.current.note.toLowerCase().includes(q)
      );
    }
    return [...result].sort((a, b) => naturalCompare(a.pipeNo, b.pipeNo));
  }, [pipes, venue, stop, onlyPending, query]);

  const pendingCount = useMemo(
    () =>
      pipes.filter(
        (p) =>
          (!venue || p.venue === venue) &&
          (!stop || p.stop === stop) &&
          isPending(p)
      ).length,
    [pipes, venue, stop]
  );

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function rowRef(id: string, el: HTMLElement | null) {
    if (el && id === focusId) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.remove("flash");
      // 强制重绘后再加高亮，保证动画播放
      void el.offsetWidth;
      el.classList.add("flash");
      onFocusHandled();
    }
  }

  return (
    <section className="panel pipe-panel">
      <div className="heading">
        <div>
          <p>调音偏差表</p>
          <h2>
            音管列表
            <span className="count-chip">
              {list.length} 根 · {pendingCount} 根待复检
            </span>
          </h2>
        </div>
        <div className="list-tools">
          <input
            className="input search"
            placeholder="搜编号 / 音高 / 备注"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            className={onlyPending ? "seg active bad" : "seg"}
            onClick={() => setOnlyPending((v) => !v)}
          >
            只看待复检
          </button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="empty">
          {venue || stop
            ? "当前场馆 / 音栓下还没有记录，在上方录入第一根音管。"
            : "请先在左侧选定场馆和音栓，然后录入音管测量数据。"}
        </div>
      ) : (
        <div className="pipe-rows">
          {list.map((r) => {
            const pending = isPending(r);
            const overLimit = Math.abs(r.current.cents) > CENT_LIMIT;
            const reedBad = r.current.reed === "abnormal";
            const currentBad = isAnomalous(r.current);
            const open = expanded.has(r.id);
            return (
              <article
                key={r.id}
                ref={(el) => rowRef(r.id, el)}
                className={
                  "pipe-row" +
                  (pending ? " pending" : "") +
                  (open ? " open" : "")
                }
              >
                <div className="pipe-main" onClick={() => toggle(r.id)}>
                  <div className="pipe-id">
                    <b>{r.pipeNo}</b>
                    <span>{r.current.pitch || "—"}</span>
                  </div>
                  <div className="pipe-metric">
                    <small>音分偏差</small>
                    <strong className={overLimit ? "bad-text" : ""}>
                      {r.current.cents > 0 ? "+" : ""}
                      {formatNumber(r.current.cents)}
                    </strong>
                  </div>
                  <div className="pipe-metric">
                    <small>温 / 湿度</small>
                    <span>
                      {formatNumber(r.current.temperature)}℃ /{" "}
                      {formatNumber(r.current.humidity)}%
                    </span>
                  </div>
                  <div className="pipe-metric">
                    <small>簧片</small>
                    <span className={reedBad ? "bad-text" : ""}>
                      {reedBad
                        ? r.current.reedNote || "异常"
                        : "正常"}
                    </span>
                  </div>
                  <div className="pipe-status">
                    {pending ? (
                      <span className="tag bad">待复检</span>
                    ) : r.traces.length > 0 ? (
                      <span className="tag resolved">已复检</span>
                    ) : (
                      <span className="tag ok">正常</span>
                    )}
                  </div>
                  <div className="pipe-chevron" aria-hidden>
                    {open ? "▲" : "▼"}
                  </div>
                </div>

                {open && (
                  <div className="pipe-detail">
                    <p className="detail-note">
                      <b>备注：</b>
                      {r.current.note || "（无）"}
                      <span className="detail-time">
                        测量于 {formatTime(r.current.at)}
                      </span>
                    </p>

                    <div className="detail-actions">
                      <button className="ghost" onClick={() => onEdit(r)}>
                        再次录入 / 编辑
                      </button>
                      <button
                        className="resolve-btn"
                        disabled={!pending || currentBad}
                        title={
                          !pending
                            ? "没有待复检项"
                            : currentBad
                            ? "当前测量仍超限或簧片异常，需先录入合格数据"
                            : "复查合格，结束待办（异常痕迹保留）"
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          onResolve(r.id);
                        }}
                      >
                        复查合格 · 结束待办
                      </button>
                    </div>

                    {pending && currentBad && (
                      <p className="detail-hint bad">
                        当前值仍异常，结束待办前请先复测并保存合格数据。
                      </p>
                    )}

                    <div className="history-grid">
                      <div>
                        <h4>
                          修订记录
                          <small>（最多 {MAX_REVISIONS} 版）</small>
                        </h4>
                        {r.revisions.length === 0 ? (
                          <p className="detail-hint">暂无旧版测量值。</p>
                        ) : (
                          <ul className="revision-list">
                            {r.revisions.map((m, i) => (
                              <li key={m.at + i}>
                                <div>
                                  <b>
                                    v{r.revisions.length - i}
                                  </b>
                                  <span>{m.pitch}</span>
                                  <span
                                    className={
                                      Math.abs(m.cents) > CENT_LIMIT
                                        ? "bad-text"
                                        : ""
                                    }
                                  >
                                    {m.cents > 0 ? "+" : ""}
                                    {formatNumber(m.cents)} cent
                                  </span>
                                  <span>
                                    {formatNumber(m.temperature)}℃ /{" "}
                                    {formatNumber(m.humidity)}%
                                  </span>
                                  <span className={m.reed === "abnormal" ? "bad-text" : ""}>
                                    簧片{m.reed === "abnormal" ? "异常" : "正常"}
                                  </span>
                                </div>
                                <time>{formatTime(m.at)}</time>
                                {m.note && <p className="rev-note">{m.note}</p>}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div>
                        <h4>异常痕迹</h4>
                        {r.traces.length === 0 ? (
                          <p className="detail-hint">该音管从未触发异常。</p>
                        ) : (
                          <ul className="trace-list">
                            {r.traces.map((t) => (
                              <li
                                key={t.id}
                                className={t.resolvedAt === null ? "open-trace" : "closed-trace"}
                              >
                                <div className="trace-head">
                                  {t.resolvedAt === null ? (
                                    <span className="tag bad">待复检</span>
                                  ) : (
                                    <span className="tag resolved">已复检</span>
                                  )}
                                  <time>{formatTime(t.measuredAt)}</time>
                                </div>
                                <p>{t.reasons.join("；")}</p>
                                {t.note && <p className="rev-note">{t.note}</p>}
                                {t.resolvedAt !== null && (
                                  <small>复检合格于 {formatTime(t.resolvedAt)}</small>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
