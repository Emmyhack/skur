'use client';

import React from 'react';

/**
 * The last line against a white screen. Anything that throws during render inside the dapp tree
 * lands here as a readable panel with the actual message — never a blank page. Nothing was
 * signed: a render crash happens on this machine, after reads, before any wallet prompt.
 */
export class Boundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('dapp render crashed', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="shell" style={{ paddingTop: 48 }}>
        <div className="card" style={{ maxWidth: 560, margin: '0 auto' }}>
          <h3>Something broke while drawing this page</h3>
          <p className="small soft" style={{ marginTop: 8 }}>
            Nothing was signed and nothing left any vault — this is a display error on your
            machine. Reloading usually clears it.
          </p>
          <p className="small faint mono" style={{ marginTop: 10, wordBreak: 'break-word' }}>
            {this.state.error.message}
          </p>
          <button
            className="btn primary"
            style={{ marginTop: 14 }}
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }
}
