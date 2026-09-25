import { Fragment, useEffect, useState } from "react";
import type { PipeRecord, Stop } from "../types";
import {
  CENTS_LIMIT,
  formatCents,
  openAnomaly,
  reasonLabels,
  reedLabels,
} from "../domain/inspection";
import { formatDateTime } from "../utils/format";

interface PipeTableProps {
  stop: Stop | undefined;
  pipes: PipeRecord[];
  locatePipeId: string | null;
  onEdit: (pipe: PipeRecord) => void;
  onResolve: (pipe: PipeRecord) => void;
  onDelete: (pipe: PipeRecord) => void;
}

export function PipeTable({ stop, pipes, locatePipeId, onEdit, onResolve, onDelete }: PipeTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // 从维护报告点异常行定位过来时，自动展开目标音管
  useEffect(() => {
    function onLocate(event: Event) {
      const pipeId = (event as CustomEvent<{ pipeId: string }>).detail?.pipeId;
      if (pipeId) setExpanded((prev) => new Set(prev).add(pipeId));
    }
    window.addEventListener("organ:locate", onLocate);
    return () => window.removeEventListener("organ:locate", onLocate);
  }, []);

  if (!stop) {
    return (
      <section className="panel table-panel">
        <div className="heading">
          <div>
            <p>音管清单</p>
            <h2>请先选择场馆和音栓</h2>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="panel table-panel">
      <div className="heading">
        <div>
          <p>音管清单 · 共 {pipes.length} 根</p>
          <h2>{stop.name}</h2>
        </div>
      </div>

      {pipes.length === 0 ? (
        <p className="empty-tip">该音栓还没有音管记录，在左侧录入第一根。</p>
      ) : (
        <div className="table-scroll">
          <table className="pipe-table">
            <thead>
              <tr>
                <th>编号</th>
                <th>音高</th>
                <th>音分偏差</th>
                <th>温度/湿度</th>
                <th>簧片</th>
                <th>状态</th>
                <th>最近保存</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {pipes.map((pipe) => {
                const over = Math.abs(pipe.current.cents) > CENTS_LIMIT;
                const open = openAnomaly(pipe);
                const isOpen = expanded.has(pipe.id);
                const located = locatePipeId === pipe.id;
                return (
                  <FragmentRow
                    key={pipe.id}
                    pipe={pipe}
                    over={over}
                    open={open}
                    isOpen={isOpen}
                    located={located}
                    onToggle={() => toggle(pipe.id)}
                    onEdit={() => onEdit(pipe)}
                    onResolve={() => onResolve(pipe)}
                    onDelete={() => onDelete(pipe)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

interface FragmentRowProps {
  pipe: PipeRecord;
  over: boolean;
  open: ReturnType<typeof openAnomaly>;
  isOpen: boolean;
  located: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onResolve: () => void;
  onDelete: () => void;
}

function FragmentRow({ pipe, over, open, isOpen, located, onToggle, onEdit, onResolve, onDelete }: FragmentRowProps) {
  return (
    <Fragment>
      <tr
        data-pipe-id={pipe.id}
        className={[
          "pipe-row",
          pipe.pending ? "row-pending" : "",
          located ? "row-located" : "",
        ].join(" ")}
      >
        <td>
          <button type="button" className="expand-btn" onClick={onToggle} aria-label={isOpen ? "收起详情" : "展开详情"}>
            {isOpen ? "▾" : "▸"} {pipe.pipeNo}
          </button>
        </td>
        <td>{pipe.current.pitch}</td>
        <td className={over ? "num-danger" : ""}>{formatCents(pipe.current.cents)}</td>
        <td className="env-cell">
          {pipe.current.temperature}℃ / {pipe.current.humidity}%
        </td>
        <td>
          <span className={pipe.current.reed === "abnormal" ? "reed-badge bad" : "reed-badge ok"}>
            {reedLabels[pipe.current.reed]}
          </span>
        </td>
        <td>
          {pipe.pending ? (
            <span className="status-badge pending">待复检</span>
          ) : (
            <span className="status-badge fine">正常</span>
          )}
          {open && (
            <span className="reason-line">
              {open.reasons.map((r) => reasonLabels[r]).join("、")}
            </span>
          )}
        </td>
        <td className="time-cell">{formatDateTime(pipe.current.savedAt)}</td>
        <td>
          <div className="row-actions">
            <button type="button" className="small" onClick={onEdit}>
              编辑
            </button>
            {pipe.pending && (
              <button type="button" className="small success" onClick={onResolve}>
                复查合格
              </button>
            )}
            <button
              type="button"
              className="small danger-text"
              onClick={onDelete}
            >
              删除
            </button>
          </div>
        </td>
      </tr>
      {isOpen && (
        <tr className="detail-row" data-pipe-id={pipe.id}>
          <td colSpan={8}>
            <PipeDetail pipe={pipe} />
          </td>
        </tr>
      )}
    </Fragment>
  );
}

function PipeDetail({ pipe }: { pipe: PipeRecord }) {
  return (
    <div className="detail-grid">
      <div className="detail-block">
        <h4>当前值</h4>
        <dl>
          <div>
            <dt>音高 / 偏差</dt>
            <dd>
              {pipe.current.pitch} · {formatCents(pipe.current.cents)} cent
            </dd>
          </div>
          <div>
            <dt>温湿度</dt>
            <dd>
              {pipe.current.temperature}℃ / {pipe.current.humidity}%
            </dd>
          </div>
          <div>
            <dt>簧片</dt>
            <dd>{reedLabels[pipe.current.reed]}</dd>
          </div>
          <div>
            <dt>保存时间</dt>
            <dd>{formatDateTime(pipe.current.savedAt)}</dd>
          </div>
          {pipe.current.note && (
            <div className="full">
              <dt>备注</dt>
              <dd>{pipe.current.note}</dd>
            </div>
          )}
        </dl>
      </div>

      <div className="detail-block">
        <h4>修订记录（最多 3 版）</h4>
        {pipe.revisions.length === 0 ? (
          <p className="empty-tip small">暂无旧值</p>
        ) : (
          <ol className="revision-list">
            {pipe.revisions.map((rev, index) => (
              <li key={rev.id} className={rev.flagged ? "was-flagged" : ""}>
                <div className="rev-head">
                  <b>第 {pipe.revisions.length - index} 版旧值</b>
                  <time>{formatDateTime(rev.savedAt)}</time>
                </div>
                <p>
                  {rev.pitch} · {formatCents(rev.cents)} cent · {rev.temperature}℃ / {rev.humidity}% · 簧片
                  {reedLabels[rev.reed]}
                </p>
                {rev.flagged && (
                  <p className="rev-reasons">当时异常：{rev.reasons.map((r) => reasonLabels[r]).join("、")}</p>
                )}
                {rev.note && <p className="rev-note">备注：{rev.note}</p>}
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="detail-block">
        <h4>异常痕迹（长期保留）</h4>
        {pipe.anomalies.length === 0 ? (
          <p className="empty-tip small">暂无异常记录</p>
        ) : (
          <ol className="anomaly-list">
            {pipe.anomalies.map((a) => (
              <li key={a.id} className={a.resolvedAt === null ? "trace-open" : "trace-closed"}>
                <div className="rev-head">
                  <b>
                    {a.resolvedAt === null ? "● 待复检" : "○ 已复查合格"}
                  </b>
                  <span className="trace-reasons">
                    {a.reasons.map((r) => reasonLabels[r]).join("、")}
                  </span>
                </div>
                <p>
                  发现 {formatDateTime(a.openedAt)}
                  {a.lastObservedAt !== a.openedAt && ` · 最近观测 ${formatDateTime(a.lastObservedAt)}`}
                  {a.resolvedAt !== null && ` · 合格于 ${formatDateTime(a.resolvedAt)}`}
                </p>
                <p>
                  {a.pitch} · {formatCents(a.cents)} cent · 簧片{reedLabels[a.reed]}
                </p>
                {a.note && <p className="rev-note">当时备注：{a.note}</p>}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
