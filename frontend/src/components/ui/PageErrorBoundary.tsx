import { Component, type ErrorInfo, type ReactNode } from 'react'

// A page that throws while rendering used to leave a blank black screen with
// the rail and top bar gone (the analytics page did, 2026-11-24). This keeps
// the chrome and says what happened. LeagueShell keys it by path, so moving to
// another page clears it.
export class PageErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Page crash:', error, info) }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="kl-pagefail" role="alert">
        <h2>This page hit an error.</h2>
        <p>Nothing was changed. Reload to try again, or use the menu to go somewhere else.</p>
        <button type="button" className="kx-btn kx-btn-gold" onClick={() => window.location.reload()}>Reload</button>
        <pre>{this.state.error.message}</pre>
      </div>
    )
  }
}
