/** Decorative, CSS-only scene: no timers or client-side hydration. */
export function BeeScene({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`bee-scene${compact ? ' bee-scene-compact' : ''}`} aria-hidden="true">
      <div className="bee-orbit orbit-one" />
      <div className="bee-orbit orbit-two" />
      <div className="hive-core">⬡</div>
      <img className="scene-queen" src="/bees/rainha.png" width="220" height="220" alt="" />
      <img className="scene-scout" src="/bees/exploradora.png" width="90" height="90" alt="" />
      <img className="scene-worker" src="/bees/atendimento.png" width="100" height="100" alt="" />
      <span className="scene-label label-one">Uma equipe conectada</span>
      <span className="scene-label label-two">Muitas possibilidades.</span>
    </div>
  );
}
