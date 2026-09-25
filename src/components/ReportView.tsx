import type { ArchiveData, PipeRecord, Venue } from "../types";
import {
  formatCents,
  openAnomaly,
  pendingPipesOfVenue,
  reasonLabels,
  reedLabels,
} from "../domain/inspection";
import { formatDateTime } from "../utils/format";

interface ReportViewProps {
  data: ArchiveData;
  venue: Venue | undefined;
  stopNameOf: (stopId: string) => string;
  onLocate: (pipe: PipeRecord) => void;
}

export function ReportView({ data, venue, stopNameOf, onLocate }: ReportViewProps) {
  if (!venue) {
    return (
      <section className="panel">
        <p className="empty-tip">请先选择场馆。</p>
      </section>
    );
  }

  const pending = pendingPipesOfVenue(data, venue.id);
  const totalPipes = data.pipes.filter((p) => p.venueId === venue.id).length;

  // 按音栓汇总
  const byStop = new Map<string, PipeRecord[]>();
  for (const pipe of pending) {
    const list = byStop.get(pipe.stopId) ?? [];
    list.push(pipe);
    byStop.set(pipe.stopId, list);
  }

  // 已处理但痕迹保留的异常（供报告底部回顾）
  const closedTraces = data.pipes
    .filter((p) => p.venueId === venue.id)
    .flatMap((p) =>
      p.anomalies
        .filter((a) => a.resolvedAt !== null)
        .map((a) => ({ pipe: p, trace: a })),
    )
    .sort((x, y) => (y.trace.resolvedAt ?? "").localeCompare(x.trace.resolvedAt ?? ""));

  return (
    <section className="panel report-panel">
      <div className="heading report-heading">
        <div>
          <p>维护报告</p>
          <h2>{venue.name} · 待复检汇总</h2>
        </div>
        <button type="button" className="ghost no-print" onClick={() => window.print()}>
          打印 / 存为 PDF
        </button>
      </div>

      <div className="report-meta">
        <span>生成时间：{formatDateTime(new Date().toISOString())}</span>
        <span>
          音管总数：<b>{totalPipes}</b>
        </span>
        <span className={pending.length > 0 ? "meta-danger" : "meta-ok"}>
          待复检：<b>{pending.length}</b>
        </span>
      </div>

      {pending.length === 0 ? (
        <div className="report-all-clear">
          <strong>当前没有待复检音管。</strong>
          <p>历史异常痕迹仍保留在各音管档案中，可在巡检台展开查看。</p>
        </div>
      ) : (
        <div className="report-groups">
          {[...byStop.entries()].map(([stopId, pipes]) => (
            <div key={stopId} className="report-group">
              <h3>
                {stopNameOf(stopId)}
                <span className="group-count">{pipes.length} 根待复检</span>
              </h3>
              <table className="report-table">
                <thead>
                  <tr>
                    <th>音管编号</th>
                    <th>音高</th>
                    <th>音分偏差</th>
                    <th>簧片</th>
                    <th>异常原因</th>
                    <th>最近观测</th>
                    <th>备注</th>
                  </tr>
                </thead>
                <tbody>
                  {pipes.map((pipe) => {
                    const open = openAnomaly(pipe);
                    return (
                      <tr
                        key={pipe.id}
                        className="report-row no-print-hover"
                        onClick={() => onLocate(pipe)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onLocate(pipe);
                          }
                        }}
                        tabIndex={0}
                        title="点击定位到该音管"
                      >
                        <td className="pipe-no-cell">{pipe.pipeNo}</td>
                        <td>{pipe.current.pitch}</td>
                        <td className="num-danger">{formatCents(pipe.current.cents)}</td>
                        <td>{reedLabels[pipe.current.reed]}</td>
                        <td>
                          <div className="reason-chips">
                            {open?.reasons.map((r) => (
                              <span key={r} className="reason-chip">
                                {reasonLabels[r]}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="time-cell">
                          {open ? formatDateTime(open.lastObservedAt) : "—"}
                        </td>
                        <td className="note-cell">{pipe.current.note || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="locate-hint no-print">点击任意异常行 → 跳转并定位到该音管</p>
            </div>
          ))}
        </div>
      )}

      {closedTraces.length > 0 && (
        <div className="report-history">
          <h3>本次周期已处理异常（痕迹保留）</h3>
          <ul>
            {closedTraces.map(({ pipe, trace }) => (
              <li key={trace.id}>
                <span className="history-stop">{stopNameOf(pipe.stopId)}</span>
                <span>
                  第 {pipe.pipeNo} 号 · {trace.pitch}
                </span>
                <span>{trace.reasons.map((r) => reasonLabels[r]).join("、")}</span>
                <span className="history-time">合格于 {formatDateTime(trace.resolvedAt as string)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
