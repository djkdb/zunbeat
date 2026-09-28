import { useEffect, useRef } from 'react';
import { useApp } from '../appContext';
import { useMenuNavigation } from '../hooks/useMenuNavigation';

interface Props {
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
}

export function PauseMenu({ onResume, onRestart, onQuit }: Props) {
  const { sfx } = useApp();
  const items = [
    { label: 'RESUME', action: onResume },
    { label: 'RESTART', action: onRestart },
    { label: 'QUIT', action: onQuit },
  ];
  const [index, setIndex] = useMenuNavigation({ count: 3, onSelect: (i) => items[i].action(), onBack: onResume });
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => refs.current[index]?.focus({ preventScroll: true }), [index]);

  return (
    <div className="pause" role="dialog" aria-modal="true" aria-label="Paused">
      <div className="pause__panel">
        <h2 className="pause__title">PAUSED</h2>
        {items.map((item, i) => (
          <button
            key={item.label}
            ref={(el) => {
              refs.current[i] = el;
            }}
            className={`pause__item${i === index ? ' is-active' : ''}`}
            onMouseEnter={() => setIndex(i)}
            onFocus={() => setIndex(i)}
            onClick={() => {
              sfx(i === 2 ? 'menuBack' : 'menuSelect');
              item.action();
            }}
          >
            {item.label}
          </button>
        ))}
        <p className="pause__hint">ESC TO RESUME</p>
      </div>
    </div>
  );
}
