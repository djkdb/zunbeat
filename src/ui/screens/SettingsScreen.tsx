import { useEffect, useState, type CSSProperties } from 'react';
import { audio } from '../../game/audio/AudioManager';
import { DEFAULT_KEYS } from '../../game/constants';
import { NOTE_SPEEDS, keyLabel, type Settings } from '../../storage/settings';
import { useApp } from '../appContext';
import { MenuBackground } from '../components/MenuBackground';
import { fullscreenSupported, toggleFullscreen, useFullscreen } from '../fullscreen';

const RESERVED = new Set(['Escape', 'Enter', 'Tab', 'KeyP']);

function Slider({
  label,
  value,
  onChange,
  onCommit,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  onCommit?: () => void;
}) {
  const id = `slider-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className="setting setting--slider">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={1}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        style={{ '--fill': `${Math.round(value * 100)}%` } as CSSProperties}
      />
      <output htmlFor={id}>{Math.round(value * 100)}</output>
    </div>
  );
}

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const { settings, updateSettings, sfx } = useApp();
  const [binding, setBinding] = useState<number | null>(null);
  const isFs = useFullscreen();
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => updateSettings({ [key]: value } as Partial<Settings>);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (binding !== null) {
        e.preventDefault();
        e.stopPropagation();
        if (e.code === 'Escape') {
          setBinding(null);
          return;
        }
        if (RESERVED.has(e.code)) return;
        const keys = [...settings.keys];
        const existing = keys.indexOf(e.code);
        if (existing >= 0) keys[existing] = keys[binding]; // swap
        keys[binding] = e.code;
        updateSettings({ keys });
        sfx('menuSelect');
        setBinding(binding < keys.length - 1 ? binding + 1 : null);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        sfx('menuBack');
        onBack();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [binding, settings.keys, updateSettings, onBack, sfx]);

  return (
    <div className="screen settings">
      <MenuBackground reducedMotion={settings.reducedMotion} accent="#c86bff" accent2="#3dc8ff" />
      <header className="screen-header">
        <button className="btn btn--ghost" onClick={() => (sfx('menuBack'), onBack())}>
          ← BACK
        </button>
        <h2 className="screen-header__title">SETTINGS</h2>
        <span className="screen-header__hint">SAVED AUTOMATICALLY</span>
      </header>

      <div className="settings__body">
        <section className="settings__group">
          <h3>AUDIO</h3>
          <Slider label="MASTER VOLUME" value={settings.masterVolume} onChange={(v) => set('masterVolume', v)} onCommit={() => audio.playSfx('hitPerfect')} />
          <Slider label="MUSIC VOLUME" value={settings.musicVolume} onChange={(v) => set('musicVolume', v)} />
          <Slider label="SFX VOLUME" value={settings.sfxVolume} onChange={(v) => set('sfxVolume', v)} onCommit={() => audio.playSfx('hitPerfect')} />
          <div className="setting">
            <span>SOUND</span>
            <button
              className={`toggle${settings.masterVolume > 0 ? ' is-on' : ''}`}
              aria-pressed={settings.masterVolume > 0}
              onClick={() => set('masterVolume', settings.masterVolume > 0 ? 0 : 0.8)}
            >
              {settings.masterVolume > 0 ? 'ON' : 'OFF'}
            </button>
          </div>
          <div className="setting">
            <label htmlFor="offset">AUDIO OFFSET</label>
            <input
              id="offset"
              type="range"
              min={-200}
              max={200}
              step={5}
              value={settings.offsetMs}
              onChange={(e) => set('offsetMs', Number(e.target.value))}
              style={{ '--fill': `${((settings.offsetMs + 200) / 400) * 100}%` } as CSSProperties}
            />
            <output htmlFor="offset">{settings.offsetMs > 0 ? `+${settings.offsetMs}` : settings.offsetMs} ms</output>
          </div>
          <p className="setting__help">Notes feel late? Lower the offset. Early? Raise it. Bluetooth headphones usually need +100 ms or more.</p>
        </section>

        <section className="settings__group">
          <h3>GAMEPLAY</h3>
          <div className="setting setting--column">
            <span>NOTE SPEED</span>
            <div className="chips" role="radiogroup" aria-label="Note speed">
              {NOTE_SPEEDS.map((s) => (
                <button
                  key={s}
                  role="radio"
                  aria-checked={settings.noteSpeed === s}
                  className={`chip${settings.noteSpeed === s ? ' is-active' : ''}`}
                  onClick={() => {
                    sfx('menuMove');
                    set('noteSpeed', s);
                  }}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>
          <div className="setting">
            <span>FAST / SLOW INDICATOR</span>
            <button className={`toggle${settings.showFastSlow ? ' is-on' : ''}`} aria-pressed={settings.showFastSlow} onClick={() => set('showFastSlow', !settings.showFastSlow)}>
              {settings.showFastSlow ? 'ON' : 'OFF'}
            </button>
          </div>
        </section>

        <section className="settings__group">
          <h3>KEY CONFIG</h3>
          <div className="keys" role="group" aria-label="Lane keys">
            {settings.keys.map((code, lane) => (
              <button
                key={lane}
                className={`keycap${binding === lane ? ' is-binding' : ''}`}
                aria-label={`Lane ${lane + 1} key: ${keyLabel(code)}. Click to change.`}
                onClick={() => setBinding(lane)}
              >
                <span className="keycap__lane">LANE {lane + 1}</span>
                <span className="keycap__key">{binding === lane ? '…' : keyLabel(code)}</span>
              </button>
            ))}
          </div>
          <p className="setting__help">
            {binding !== null ? `Press a key for lane ${binding + 1} (ESC to cancel).` : 'Click a lane, then press the key you want. ESC always pauses.'}
          </p>
          <button className="btn btn--ghost btn--small" onClick={() => updateSettings({ keys: [...DEFAULT_KEYS] })}>
            RESET TO D F J K
          </button>
        </section>

        <section className="settings__group">
          <h3>DISPLAY</h3>
          <div className="setting">
            <span>REDUCED MOTION</span>
            <button className={`toggle${settings.reducedMotion ? ' is-on' : ''}`} aria-pressed={settings.reducedMotion} onClick={() => set('reducedMotion', !settings.reducedMotion)}>
              {settings.reducedMotion ? 'ON' : 'OFF'}
            </button>
          </div>
          <p className="setting__help">Removes screen shake, flashes and camera movement.</p>
          {fullscreenSupported() && (
            <div className="setting">
              <span>FULLSCREEN</span>
              <button className={`toggle${isFs ? ' is-on' : ''}`} aria-pressed={isFs} onClick={() => void toggleFullscreen()}>
                {isFs ? 'ON' : 'OFF'}
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
