import { useEffect, useState, type ReactNode } from "react";
import { explorerAddress, explorerTx } from "../config/chain";
import { short } from "../lib/format";
import { Mode, MODE_LABEL, Status, STATUS_LABEL, Tier, TIER_LABEL, Trust, TRUST_LABEL } from "../lib/types";
import type { TxState } from "../hooks/useTx";
import { IconCheck, IconClose, IconCopy, IconExternal } from "./icons";

export function Card({ title, subtitle, actions, children, className = "", flush = false }: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; flush?: boolean }) {
  return (
    <section className={`card ${flush ? "flush" : ""} ${className}`}>
      {(title || actions) && (
        <header className="card-head">
          <div>
            {title && <h4>{title}</h4>}
            {subtitle && <p className="sub">{subtitle}</p>}
          </div>
          {actions && <div className="card-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "ok" | "warn" | "bad" }) {
  return (
    <div className={`stat ${tone ? `stat-${tone}` : ""}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value num">{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

export type Tone = "neutral" | "ok" | "warn" | "bad" | "info" | "review" | "brand";

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

/** "1 out of 2" confirmation pill, the way Safe shows signature progress in its queue. */
export function ConfirmPill({ have, need, label = "" }: { have: number; need: number; label?: string }) {
  const done = have >= need;
  return (
    <span className={`pill ${done ? "pill-ok" : "pill-review"}`} title={label}>
      {done ? <IconCheck width={12} height={12} /> : null}
      {have} out of {need}
      {label ? ` ${label}` : ""}
    </span>
  );
}

export function TierBadge({ tier }: { tier: Tier }) {
  const tone: Tone = tier === Tier.LOW ? "ok" : tier === Tier.HIGH ? "warn" : "bad";
  return <Badge tone={tone}>{TIER_LABEL[tier]} risk</Badge>;
}

export function ModeBadge({ mode }: { mode: Mode }) {
  const tone: Tone = mode === Mode.NORMAL ? "ok" : mode === Mode.ELEVATED ? "warn" : "bad";
  return <Badge tone={tone}>{MODE_LABEL[mode]}</Badge>;
}

export function StatusBadge({ status }: { status: Status }) {
  const tone: Tone = status === Status.EXECUTED ? "ok" : status === Status.PENDING ? "review" : status === Status.VETOED ? "bad" : "neutral";
  return <Badge tone={tone}>{STATUS_LABEL[status]}</Badge>;
}

export function TrustBadge({ trust }: { trust: Trust }) {
  const tone: Tone =
    trust === Trust.TRUSTED || trust === Trust.VERIFIED ? "ok" : trust === Trust.NEW ? "info" : trust === Trust.UNKNOWN ? "neutral" : "bad";
  return <Badge tone={tone}>{TRUST_LABEL[trust]}</Badge>;
}

export function CopyButton({ value, small = true }: { value: string; small?: boolean }) {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (!ok) return;
    const t = setTimeout(() => setOk(false), 1200);
    return () => clearTimeout(t);
  }, [ok]);
  return (
    <button
      className={`icon-btn ${small ? "small" : ""}`}
      title="Copy"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard?.writeText(value).then(() => setOk(true));
      }}
    >
      {ok ? <IconCheck width={14} height={14} /> : <IconCopy width={14} height={14} />}
    </button>
  );
}

export function Address({ value, label, full = false, copy = false }: { value: string; label?: string; full?: boolean; copy?: boolean }) {
  return (
    <span className="addr">
      {label ? <span className="strong">{label}</span> : null}
      <a href={explorerAddress(value)} target="_blank" rel="noreferrer" title={value}>
        <code>{full ? value : short(value)}</code>
      </a>
      {copy && <CopyButton value={value} />}
    </span>
  );
}

export function TxLink({ hash }: { hash: string }) {
  return (
    <a className="addr" href={explorerTx(hash)} target="_blank" rel="noreferrer">
      <code>{short(hash, 6)}</code>
      <IconExternal width={12} height={12} />
    </a>
  );
}

export function Button({ children, onClick, kind = "primary", disabled, type = "button", title, size, block, icon }: { children: ReactNode; onClick?: () => void; kind?: "primary" | "secondary" | "danger" | "ghost" | "brand"; disabled?: boolean; type?: "button" | "submit"; title?: string; size?: "sm"; block?: boolean; icon?: ReactNode }) {
  return (
    <button type={type} className={`btn btn-${kind} ${size === "sm" ? "btn-sm" : ""} ${block ? "btn-block" : ""}`} onClick={onClick} disabled={disabled} title={title}>
      {icon}
      {children}
    </button>
  );
}

export function Field({ label, children, hint }: { label: ReactNode; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function TxStatus({ state }: { state: TxState }) {
  if (state.phase === "idle") return null;
  if (state.phase === "error") return <div className="notice notice-bad">{state.message}</div>;
  if (state.phase === "done")
    return (
      <div className="notice notice-ok">
        <span>Confirmed onchain.</span> <TxLink hash={state.hash} />
      </div>
    );
  if (state.phase === "mining")
    return (
      <div className="notice notice-info">
        <span>Waiting for the block…</span> <TxLink hash={state.hash} />
      </div>
    );
  return <div className="notice notice-info">{state.phase === "simulating" ? "Checking the transaction against the vault policy…" : "Confirm in your wallet…"}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function KV({ rows }: { rows: Array<[ReactNode, ReactNode]> }) {
  return (
    <dl className="kv">
      {rows.map(([k, v], i) => (
        <div key={i}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (t: T) => void; items: Array<{ id: T; label: ReactNode; count?: number }> }) {
  return (
    <div className="tabs">
      {items.map((it) => (
        <button key={it.id} className={value === it.id ? "active" : ""} onClick={() => onChange(it.id)}>
          {it.label}
          {it.count !== undefined && it.count > 0 && <Badge tone="review">{it.count}</Badge>}
        </button>
      ))}
    </div>
  );
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: ReactNode }) {
  return (
    <span className={`switch ${on ? "on" : ""}`} onClick={() => onChange(!on)} role="switch" aria-checked={on}>
      <span className="track" />
      {label && <span>{label}</span>}
    </span>
  );
}

export function TokenIcon({ symbol }: { symbol: string }) {
  const s = symbol.toUpperCase();
  const glyph = s.includes("USD") ? "$" : s.slice(0, 1);
  const stable = s.includes("USD");
  return (
    <span className="token-ico" style={stable ? { background: "var(--brand-bg)", color: "var(--success-dark)" } : undefined}>
      {glyph}
    </span>
  );
}

export function Modal({ title, onClose, children, footer, steps }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; steps?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal>
        <div className="modal-head">
          <div>
            <h4>{title}</h4>
            {steps && <div className="steps" style={{ marginTop: 6 }}>{steps}</div>}
          </div>
          <button className="icon-btn small" onClick={onClose} title="Close">
            <IconClose width={16} height={16} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
