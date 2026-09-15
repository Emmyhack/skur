import type { ReactNode } from "react";
import { useScrolled } from "../lib/motion";
import { IconChevronRight } from "./icons";

export type MarketingPage = "landing" | "product" | "solutions" | "security";

/** Nav, closing CTA and footer shared by every marketing page, after safe.global. */
export function MarketingShell({ page, onLaunch, children, hideCta = false }: { page: MarketingPage; onLaunch: () => void; children: ReactNode; hideCta?: boolean }) {
  const scrolled = useScrolled();
  return (
    <div className="land">
      <header className={`land-nav ${scrolled ? "scrolled" : ""}`}>
        <div className="wrap">
          <a className="logo" href="#/"><span className="mark">S</span><span>Skur<span className="brace">{"{"}</span>Vault<span className="brace">{"}"}</span></span></a>
          <nav>
            <a href="#/product" className={page === "product" ? "on" : ""}>Product</a>
            <a href="#/solutions" className={page === "solutions" ? "on" : ""}>Solutions</a>
            <a href="#/security" className={page === "security" ? "on" : ""}>Security</a>
            <a href="#/#faq">FAQ</a>
            <a href="https://github.com/Emmyhack/skur" target="_blank" rel="noreferrer">GitHub ↗</a>
          </nav>
          <button className="btn btn-accent" onClick={onLaunch}>Launch app <IconChevronRight width={16} height={16} /></button>
        </div>
      </header>
      {children}
      {!hideCta && (
        <section className="cta">
          <div className="grid-bg" style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(#e9ecef 1px, transparent 1px), linear-gradient(90deg, #e9ecef 1px, transparent 1px)", backgroundSize: "131px 131px" }} />
          {[[0, 0], [1310, 0], [520, 260], [780, 0], [130, 390], [1050, 390]].map(([x, y], i) => (
            <span key={i} className="cell" style={{ position: "absolute", width: 130, height: 130, left: x, top: y, background: "linear-gradient(180deg, rgba(33,37,41,0) 0%, rgba(33,37,41,0.2) 100%)", animation: `cell ${5 + i}s ease-in-out infinite`, animationDelay: `${i * 0.4}s` }} />
          ))}
          <div className="wrap" style={{ position: "relative" }}>
            <h2>Put a firewall in front of<br /><span>your treasury</span></h2>
            <p className="sub">Secure, self-custodial and readable by the people who sign</p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <a className="btn btn-white" href="https://github.com/Emmyhack/skur/blob/main/docs/SECURITY_MODEL.md" target="_blank" rel="noreferrer">Read docs</a>
              <button className="btn btn-accent" onClick={onLaunch}>Launch app <IconChevronRight width={16} height={16} /></button>
            </div>
          </div>
        </section>
      )}
      <footer className="land-footer">
        <div className="wrap">
          <div className="cols">
            <div><a className="logo" href="#/" style={{ fontWeight: 800, fontSize: 20 }}>Skur</a><p style={{ color: "#adb5bd", marginTop: 12, maxWidth: 240 }}>Programmable treasury security for onchain businesses.</p></div>
            <div><h5>Product</h5><ul><li><a href="#/product">Risk-tiered vault</a></li><li><a href="#/security">Guardians</a></li><li><a href="#/product#simulator">Policy simulator</a></li><li><a href="https://github.com/Emmyhack/skur/tree/main/contracts" target="_blank" rel="noreferrer">Contracts</a></li></ul></div>
            <div><h5>Solutions</h5><ul><li><a href="#/solutions">Finance teams</a></li><li><a href="#/solutions#guardians">Guardians</a></li><li><a href="#/solutions#dao">DAOs & funds</a></li></ul></div>
            <div><h5>Company</h5><ul><li><a href="https://github.com/Emmyhack/skur" target="_blank" rel="noreferrer">GitHub</a></li><li><a href="https://github.com/Emmyhack/skur/blob/main/docs/DECISIONS.md" target="_blank" rel="noreferrer">Decisions</a></li></ul></div>
            <div><h5>Resources</h5><ul><li><a href="#/#faq">FAQs</a></li><li><a href="https://github.com/Emmyhack/skur/blob/main/docs/SECURITY_MODEL.md" target="_blank" rel="noreferrer">Security model</a></li><li><a href="https://explorer.34.60.137.196.sslip.io" target="_blank" rel="noreferrer">Explorer</a></li><li><a href="https://faucet.34.60.137.196.sslip.io/" target="_blank" rel="noreferrer">Faucet</a></li></ul></div>
            <div><h5>Social</h5><ul><li><a href="https://github.com/Emmyhack/skur" target="_blank" rel="noreferrer">GitHub</a></li></ul></div>
          </div>
          <div className="legal"><span>Skur V1 · Ark Constellation devnet</span><span>MIT licensed. Not a guarantee against loss; read the security model.</span></div>
          <div className="giant">Skur</div>
        </div>
      </footer>
    </div>
  );
}

/** Hero used by the product, solutions and security pages. */
export function SubHero({ eyebrow, title, sub, onLaunch, children }: { eyebrow: string; title: ReactNode; sub: string; onLaunch: () => void; children?: ReactNode }) {
  return (
    <section className="hero sub-hero">
      <div className="grid-bg" />
      {[[0, 130], [1310, 0], [1180, 260], [130, 390], [910, 390]].map(([x, y], i) => (
        <span key={i} className="cell" style={{ left: x, top: y, animationDelay: `${i * 0.6}s` }} />
      ))}
      <div className="wrap">
        <div className="eyebrow">{eyebrow}</div>
        <h1 style={{ fontSize: 64, lineHeight: "66px", maxWidth: 860 }}>{title}</h1>
        <p className="sub">{sub}</p>
        <div className="cta-row">
          <button className="btn btn-accent btn-lg" onClick={onLaunch}>Launch app <IconChevronRight width={16} height={16} /></button>
          {children}
        </div>
      </div>
    </section>
  );
}
