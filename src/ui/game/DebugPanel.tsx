import { useEffect, useRef, useState } from 'react';
import type { GameEngine } from '../../game/engine/GameEngine';
import type { DebugPresenter } from './DebugPresenter';
import { resetRecords } from '../../storage/records';

interface Props {
  engine: GameEngine | null;
  presenter: DebugPresenter;
  onRestart: () => void;
}

export function DebugPanel({ engine, presenter, onRestart }: Props) {
  const pre = useRef<HTMLPreElement>(null);
  const [open, setOpen] = useState(true);
  const [auto, setAuto] = useState(engine?.autoplay ?? false);
  useEffect(() => {
    presenter.attach(pre.current);
    return () => presenter.attach(null);
  }, [presenter, open, engine]);
  if (!engine) return null;
  const d = engine.debug;
  return (
    <div className={`debug${open ? '' : ' debug--closed'}`} onPointerDown={(e) => e.stopPropagation()}>
      <button className="debug__toggle" onClick={() => setOpen((o) => !o)}>
        DEBUG {open ? '▾' : '▸'}
      </button>
      {open && (
        <>
          <pre ref={pre} className="debug__stats" />
          <div className="debug__buttons">
            <button onClick={onRestart}>Restart</button>
            <button onClick={() => d.skip(10)}>Skip 10 sec</button>
            <button onClick={d.triggerFever}>Trigger Fever</button>
            <button onClick={d.spawnTestNote}>Spawn Test Note</button>
            <button onClick={() => d.forceNext('perfect')}>Perfect Test</button>
            <button onClick={() => d.forceNext('miss')}>Miss Test</button>
            <button onClick={d.finishNow}>Finish Song</button>
            <button
              onClick={() => {
                if (window.confirm('Reset all records?')) resetRecords();
              }}
            >
              Reset Records
            </button>
            <button
              className={auto ? 'is-on' : ''}
              onClick={() => {
                d.setAutoplay(!auto);
                setAuto(!auto);
              }}
            >
              Autoplay {auto ? 'ON' : 'OFF'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
