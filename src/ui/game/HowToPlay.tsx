import { useEffect } from 'react';
import { keyLabel } from '../../storage/settings';

interface Props {
  keys: string[];
  touch: boolean;
  onStart: () => void;
}

/** One-time primer shown before the first song: lanes, note types, FEVER and pause. */
export function HowToPlay({ keys, touch, onStart }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.key === 'Tab') return;
      e.preventDefault();
      onStart();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onStart]);

  return (
    <div className="howto" role="dialog" aria-modal="true" aria-label="How to play">
      <div className="howto__panel">
        <h2>HOW TO PLAY</h2>
        <div className="howto__lanes" aria-hidden="true">
          {[0, 1, 2, 3].map((lane) => (
            <div key={lane} className="howto__lane">
              <i className="howto__note" style={{ animationDelay: `${lane * 0.35}s` }} />
              <span className="howto__key">{touch ? 'TAP' : keyLabel(keys[lane])}</span>
            </div>
          ))}
        </div>
        <p className="howto__lead">
          {touch ? 'Tap a lane' : `Press ${keys.map(keyLabel).join(' ')}`} when a note reaches the line.
        </p>
        <ul className="howto__list">
          <li>
            <b className="howto__tag howto__tag--hold">HOLD</b>
            <span>keep {touch ? 'your finger down' : 'the key down'} until the tail passes</span>
          </li>
          <li>
            <b className="howto__tag howto__tag--release">RELEASE</b>
            <span>hold, then let go right on the arrow — the release is judged</span>
          </li>
          <li>
            <b className="howto__tag howto__tag--roll">ROLL</b>
            <span>striped bar: {touch ? 'tap' : 'hit the key'} again and again until it ends</span>
          </li>
          <li>
            <b className="howto__tag howto__tag--double">DOUBLE</b>
            <span>two linked notes — hit both together</span>
          </li>
          <li>
            <b className="howto__tag howto__tag--fever">FEVER</b>
            <span>chain good hits to fill the gauge: ×1.5 score</span>
          </li>
          <li>
            <b className="howto__tag">PAUSE</b>
            <span>{touch ? 'the ❚❚ button, top right' : 'ESC or the ❚❚ button'}</span>
          </li>
        </ul>
        <button className="btn btn--primary howto__go" onClick={onStart} autoFocus>
          GOT IT — START
        </button>
        <p className="howto__hint">{touch ? 'Tip: play in fullscreen, sound on.' : 'Press any key to start.'}</p>
      </div>
    </div>
  );
}
