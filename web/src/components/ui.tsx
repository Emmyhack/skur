import type { ReactNode } from "react";
import { explorerAddress, explorerTx } from "../config/chain";
import { short } from "../lib/format";
import { Mode, MODE_LABEL, Status, STATUS_LABEL, Tier, TIER_LABEL, Trust, TRUST_LABEL } from "../lib/types";
import type { TxState } from "../hooks/useTx";

export function Card({ title, subtitle, actions, children, className = "" }: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="card-head">
          <div>
            {title && <h3>{title}</h3>}
            {subtitle && <p className="muted">{subtitle}</p>}
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
      <div className="stat-value">{value}</div>
      {hint && <div className="stat-hint muted">{hint}</div>}
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "ok" | "warn" | "bad" | "info" }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function TierBadge({ tier }: { tier: Tier }) {
  const tone = tier === Tier.LOW ? "ok" : tier === Tier.HIGH ? "warn" : "bad";
  return <Badge tone={tone}>{TIER_LABEL[tier]} risk</Badge>;
}

export function ModeBadge({ mode }: { mode: Mode }) {
  const tone = mode === Mode.NORMAL ? "ok" : mode === Mode.ELEVATED ? "warn" : "bad";
  return <Badge tone={tone}>{MODE_LABEL[mode]}</Badge>;
}

export function StatusBadge({ status }: { status: Status }) {
  const tone = status === Status.EXECUTED ? "ok" : status === Status.PENDING ? "info" : status === Status.VETOED ? "bad" : "neutral";
  return <Badge tone={tone}>{STATUS_LABEL[status]}</Badge>;
}

export function TrustBadge({ trust }: { trust: Trust }) {
  const tone =
    trust === Trust.TRUSTED || trust === Trust.VERIFIED ? "ok" : trust === Trust.NEW ? "info" : trust === Trust.UNKNOWN ? "neutral" : "bad";
  return <Badge tone={tone}>{TRUST_LABEL[trust]}</Badge>;
}

export function Address({ value, label, full = false }: { value: string; label?: string; full?: boolean }) {
  return (
    <a className="addr" href={explorerAddress(value)} target="_blank" rel="noreferrer" title={value}>
      {label ? <span className="addr-label">{label} </span> : null}
      <code>{full ? value : short(value)}</code>
    </a>
  );
}

export function TxLink({ hash }: { hash: string }) {
  return (
    <a className="addr" href={explorerTx(hash)} target="_blank" rel="noreferrer">
      <code>{short(hash, 6)}</code>
    </a>
  );
}

export function Button({ children, onClick, kind = "primary", disabled, type = "button", title }: { children: ReactNode; onClick?: () => void; kind?: "primary" | "secondary" | "danger" | "ghost"; disabled?: boolean; type?: "button" | "submit"; title?: string }) {
  return (
    <button type={type} className={`btn btn-${kind}`} onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>
  );
}

export function Field({ label, children, hint }: { label: ReactNode; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint muted">{hint}</span>}
    </label>
  );
}

export function TxStatus({ state }: { state: TxState }) {
  if (state.phase === "idle") return null;
  if (state.phase === "error") return <div className="notice notice-bad">{state.message}</div>;
  if (state.phase === "done")
    return (
      <div className="notice notice-ok">
        Confirmed. <TxLink hash={state.hash} />
      </div>
    );
  if (state.phase === "mining")
    return (
      <div className="notice notice-info">
        Waiting for confirmation… <TxLink hash={state.hash} />
      </div>
    );
  return <div className="notice notice-info">{state.phase === "simulating" ? "Checking the policy…" : "Confirm in your wallet…"}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty muted">{children}</div>;
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
