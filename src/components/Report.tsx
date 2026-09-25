import { useMemo } from "react";
import {
  buildPendingGroups,
  formatNumber,
  formatTime,
  resolvedTraceRecords,
} from "../domain";
import type { PipeRecord } from "../types";

interface ReportProps {
  pipes: PipeRecord[];
  onLocate: (record: PipeRecord) => void;
}

export function Report({ pipes, onLocate }: ReportProps) {
  const groups = useMemo(() => buildPendingGroups(pipes), [pipes]);
  const resolved = useMemo(() => resolvedTraceRecords(pipes), [pipes]);

  const pendingTotal = groups.reduce((sum, g) => sum + g.rows.length, 0);
  const overLimitCount = pipes
    .filter((p) => p.traces.some((t) => t.resolvedAt === null))
    .filter((p) => Math.abs(p.current.cents) > 10).length;
  const reedBadCount = pipes
    .filter((p) => p.traces.some((t) => t.resolvedAt === null))
    .filter((p) => p.current.reed === "abnormal").length;
  const venueCount = new Set(pipes.map((p) => p.venue)).size;

  const latestAt = groups
    .flatMap((g) => g.rows.map((r) => r.record.current.at))
    .sort()
    .pop();

  return (
    <section className="panel report-panel">
      <div className="heading report-heading">
        <div>
          <p>单次维护报告</p>
          <h2>待复检汇总</h2>
        </div>
        <button className="ghost" onClick={() => window.print()}>
          打印 / 存为 PDF
        </button>
      </div>

      <div className="report-stats">
        <article>
          <small>待复检音管</small>
          <strong className={pendingTotal > 0 ? "bad-text" : ""}>
            {pendingTotal}
          </strong>
        </article>
        <article>
          <small>偏差超限</small>
          <strong>{overLimitCount}</strong>
        </article>
        <article>
          <small>簧片异常</small>
          <strong>{reedBadCount}</strong>
        </article>
        <article>
          <small>涉及场馆</small>
          <strong>{venueCount}</strong>
        </article>
      </div>

      {pendingTotal === 0 ? (
        <div className="empty">
          当前没有待复检音管。报告按待复检情况生成；历史异常痕迹仍保留在各音管档案中。
        </div>
      ) : (
        <div className="report-groups">
          {groups.map((g) => (
            <div className="report-group" key={`${g.venue}|${g.stop}`}>
              <h3>
                {g.venue}
                <span className="group-stop"> · {g.stop}</span>
                <b>{g.rows.length}</b>
              </h3>
              <table className="report-table">
                <thead>
                  <tr>
                    <th>音管</th>
                    <th>音高</th>
                    <th>音分偏差</th>
                    <th>温 / 湿度</th>
                    <th>异常原因</th>
                    <th>备注</th>
                    <th>标记时间</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map(({ record, trace }) => {
                    const overLimit = Math.abs(record.current.cents) > 10;
                    return (
                      <tr
                        key={record.id}
                        className="report-row"
                        onClick={() => onLocate(record)}
                        title="点击定位到该音管"
                      >
                        <td className="cell-no">{record.pipeNo}</td>
                        <td>{record.current.pitch}</td>
                        <td
                          className={
                            overLimit ? "bad-text num" : "num"
                          }
                        >
                          {record.current.cents > 0 ? "+" : ""}
                          {formatNumber(record.current.cents)}
                        </td>
                        <td className="num">
                          {formatNumber(record.current.temperature)}℃ /{" "}
                          {formatNumber(record.current.humidity)}%
                        </td>
                        <td className="cell-reasons">
                          {trace.reasons.join("；")}
                        </td>
                        <td className="cell-note">
                          {trace.note || record.current.note || "—"}
                        </td>
                        <td className="num">{formatTime(trace.measuredAt)}</td>
                        <td className="cell-locate">定位 →</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {latestAt && (
        <p className="report-foot">
          数据截至最近一次保存：{formatTime(latestAt)}
        </p>
      )}

      <details className="resolved-box" open={pendingTotal === 0}>
        <summary>
          历史异常痕迹（已复检合格，共 {resolved.length} 根，痕迹保留可追溯）
        </summary>
        {resolved.length === 0 ? (
          <p className="detail-hint">暂无已闭合的异常记录。</p>
        ) : (
          <ul className="resolved-list">
            {resolved.map((r) => {
              const last = r.traces[0];
              return (
                <li key={r.id}>
                  <button
                    className="resolved-link"
                    onClick={() => onLocate(r)}
                  >
                    <b>
                      {r.venue} · {r.stop} · {r.pipeNo}
                    </b>
                    <span>{last?.reasons.join("；")}</span>
                    {last?.resolvedAt && (
                      <time>合格于 {formatTime(last.resolvedAt)}</time>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </details>
    </section>
  );
}
