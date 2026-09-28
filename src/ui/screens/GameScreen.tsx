import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { audio } from '../../game/audio/AudioManager';
import { SoundPresenter } from '../../game/audio/SoundPresenter';
import { GameEngine, type EnginePhase, type GamePresenter } from '../../game/engine/GameEngine';
import { laneAtX } from '../../game/render/layout';
import { PlayfieldRenderer } from '../../game/render/PlayfieldRenderer';
import { getSong, loadChart, songAnalysis } from '../../game/songs';
import type { Chart, DifficultyId, PlayResult, SongDefinition } from '../../game/types';
import { DEBUG_ENABLED, DEBUG_PANEL } from '../../debug';
import { TUTORIAL_VERSION, keyLabel } from '../../storage/settings';
import { useApp } from '../appContext';
import { DebugPanel } from '../game/DebugPanel';
import { DebugPresenter } from '../game/DebugPresenter';
import { Hud } from '../game/Hud';
import { HudController, type HudRefs } from '../game/HudController';
import { PauseMenu } from '../game/PauseMenu';
import { HowToPlay } from '../game/HowToPlay';
import { isTouchPrimary } from '../device';
import { Jacket } from '../components/Jacket';
import { toggleFullscreen, fullscreenSupported, useFullscreen } from '../fullscreen';

interface Props {
  songId: string;
  difficulty: DifficultyId;
  autoplay: boolean;
  onFinish: (result: PlayResult) => void;
  onRestart: () => void;
  onQuit: () => void;
}

function LoadingProgress({ songId }: { songId: string }) {
  const [fraction, setFraction] = useState(0);
  useEffect(() => audio.onSongProgress(songId, setFraction), [songId]);
  return (
    <span className="progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fraction * 100)}>
      <i style={{ transform: `scaleX(${Math.max(0.03, fraction)})` }} />
      <b>{Math.round(fraction * 100)}%</b>
    </span>
  );
}

type Prepared = { ok: false; error: string } | { ok: true; song: SongDefinition; chart: Chart };

type Status = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; silent: boolean };

export function GameScreen({ songId, difficulty, autoplay, onFinish, onRestart, onQuit }: Props) {
  const { settings, updateSettings, sfx } = useApp();
  const song = getSong(songId);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HudRefs | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [engine, setEngine] = useState<GameEngine | null>(null);
  const [runtimeStatus, setStatus] = useState<Status>({ kind: 'loading' });

  // Validate song + chart up front; a broken chart shows an error instead of crashing.
  const prepared = useMemo((): Prepared => {
    if (!song) return { ok: false, error: `Unknown song "${songId}".` };
    const parsed = loadChart(song, difficulty);
    if (!parsed || parsed.chart.notes.length === 0) {
      return {
        ok: false,
        error: parsed?.errors.length
          ? `Chart error (line ${parsed.errors[0].line}): ${parsed.errors[0].message}`
          : 'This difficulty has no playable chart.',
      };
    }
    if (parsed.errors.length) console.warn('[chart] errors', parsed.errors);
    return { ok: true, song, chart: parsed.chart };
  }, [song, songId, difficulty]);
  const status: Status = prepared.ok ? runtimeStatus : { kind: 'error', message: prepared.error };
  const [phase, setPhase] = useState<EnginePhase>('ready');
  const [debugPresenter] = useState(() => new DebugPresenter());
  const isFullscreen = useFullscreen();
  const [touch] = useState(isTouchPrimary);
  // Read once per play: the HOW TO PLAY card gates the very first song.
  const [needTutorial] = useState(() => settings.tutorialSeen < TUTORIAL_VERSION);
  const [showTutorial, setShowTutorial] = useState(false);

  // Keep latest callbacks without restarting the engine.
  const callbacks = useRef({ onFinish, onQuit });
  useEffect(() => {
    callbacks.current = { onFinish, onQuit };
  });

  const togglePause = useCallback(() => {
    const e = engineRef.current;
    if (!e) return;
    if (e.phase === 'paused') e.resume();
    else e.pause();
  }, []);

  useEffect(() => {
    if (!prepared.ok) return;
    const { song, chart } = prepared;
    let cancelled = false;
    let observer: ResizeObserver | null = null;
    let created: GameEngine | null = null;
    const onVisibility = () => {
      if (document.hidden) created?.pause();
    };
    // Desktop: switching to another window pauses too (keys can't reach the game).
    const onBlur = () => {
      if (!touch && created && created.phase !== 'countdown') created.pause();
    };

    audio.stopPreview(0.2);
    void audio.loadSong(song).then((buffer) => {
      if (cancelled) return;
      const container = containerRef.current;
      const canvas = canvasRef.current;
      const surface = surfaceRef.current;
      const hudRefs = hudRef.current;
      if (!container || !canvas || !surface || !hudRefs) return;
      try {
        const renderer = new PlayfieldRenderer(canvas, {
          theme: song.theme,
          noteSpeed: settings.noteSpeed,
          reducedMotion: settings.reducedMotion,
          keyLabels: touch ? [] : settings.keys.map(keyLabel),
          touchHints: touch,
        });
        const hud = new HudController(hudRefs, {
          reducedMotion: settings.reducedMotion,
          showFastSlow: settings.showFastSlow,
        });
        const resize = () => {
          renderer.resize(container.clientWidth, container.clientHeight);
          hud.applyLayout(renderer.layout);
        };
        resize();
        observer = new ResizeObserver(resize);
        observer.observe(container);

        const presenters: GamePresenter[] = [renderer, hud, new SoundPresenter(audio), { phase: (p: EnginePhase) => setPhase(p) }];
        if (DEBUG_ENABLED) presenters.push(debugPresenter);
        created = new GameEngine({
          song,
          difficulty,
          chart,
          analysis: songAnalysis(song),
          buffer,
          audio,
          surface,
          keys: settings.keys,
          laneAtX: (x) => laneAtX(renderer.layout, x - container.getBoundingClientRect().left),
          userOffsetMs: settings.offsetMs,
          autoplay,
          presenters,
          onFinish: (r) => callbacks.current.onFinish(r),
          onPauseRequest: togglePause,
        });
        engineRef.current = created;
        setEngine(created);
        setStatus({ kind: 'ready', silent: !created.hasAudio });
        document.addEventListener('visibilitychange', onVisibility);
        window.addEventListener('blur', onBlur);
        if (needTutorial) {
          created.renderStill();
          setShowTutorial(true);
        }
        else created.start();
        if (DEBUG_ENABLED) (window as unknown as { __BEATSHIFT__?: unknown }).__BEATSHIFT__ = { engine: created };
      } catch (err) {
        console.error(err);
        setStatus({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
      }
    });

    return () => {
      cancelled = true;
      observer?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      created?.destroy();
      engineRef.current = null;
    };
    // Settings are read once per play on purpose; changing them mid-song would desync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepared, difficulty, autoplay, debugPresenter, togglePause, needTutorial, touch]);

  const paused = phase === 'paused';

  return (
    <div className={`screen game${settings.reducedMotion ? ' reduced-motion' : ''}`} ref={containerRef}>
      <canvas ref={canvasRef} className="game__canvas" aria-label="Rhythm game playfield" />
      <div ref={surfaceRef} className="game__surface" aria-hidden="true" />
      {song && <Hud ref={hudRef} song={song} difficulty={difficulty} autoplay={autoplay} />}

      <div className="game__controls">
        {fullscreenSupported() && (
          <button className="icon-btn" aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'} onClick={() => void toggleFullscreen()}>
            {isFullscreen ? '⤡' : '⤢'}
          </button>
        )}
        <button
          className="icon-btn"
          aria-label="Pause"
          onClick={() => {
            sfx('menuSelect');
            togglePause();
          }}
          disabled={status.kind !== 'ready' || phase === 'ready' || phase === 'finishing' || phase === 'finished'}
        >
          ❚❚
        </button>
      </div>

      {status.kind === 'loading' && song && (
        <div className="game__loading" role="status">
          <Jacket song={song} size="md" />
          <div className="game__loading-text">
            <span className="game__loading-title">{song.title}</span>
            <span className="game__loading-sub">SYNTHESIZING AUDIO…</span>
            <LoadingProgress songId={song.id} />
          </div>
        </div>
      )}
      {status.kind === 'ready' && status.silent && phase === 'countdown' && (
        <div className="game__notice">AUDIO UNAVAILABLE — PLAYING WITHOUT MUSIC</div>
      )}
      {status.kind === 'error' && (
        <div className="game__error" role="alert">
          <h2>CAN'T START THIS SONG</h2>
          <p>{status.message}</p>
          <button className="btn btn--primary" onClick={onQuit} autoFocus>
            BACK TO SONG SELECT
          </button>
        </div>
      )}
      {showTutorial && (
        <HowToPlay
          keys={settings.keys}
          touch={touch}
          onStart={() => {
            setShowTutorial(false);
            updateSettings({ tutorialSeen: TUTORIAL_VERSION });
            audio.unlock();
            engineRef.current?.start();
          }}
        />
      )}
      {paused && (
        <PauseMenu
          onResume={() => engineRef.current?.resume()}
          onRestart={onRestart}
          onQuit={onQuit}
        />
      )}
      {DEBUG_PANEL && <DebugPanel engine={engine} presenter={debugPresenter} onRestart={onRestart} />}
    </div>
  );
}
