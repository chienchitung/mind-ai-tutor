export function GameLoadingShell() {
  return <div className="game-loading-shell" role="status" aria-live="polite" aria-label="正在載入遊戲樣板">
    <header><span className="game-loading-logo" /><span className="game-loading-stat" /></header>
    <main>
      <section className="game-loading-hero"><span /><span /><span /></section>
      <div className="game-loading-grid"><section><span /><span /><span /></section><aside><span /><span /></aside></div>
    </main>
    <span className="sr-only">正在載入遊戲內容…</span>
  </div>
}
