import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { audio } from './game/audio/AudioManager';
import type { SfxName } from './game/audio/synth/renderSfx';
import { isDifficultyId } from './game/config/difficulty';
import { getSong } from './game/songs';
import type { DifficultyId, PlayResult } from './game/types';
import { DEBUG_AUTOPLAY } from './debug';
import { loadRecords, saveResult, type SaveOutcome } from './storage/records';
import { loadSettings, saveSettings, type Settings } from './storage/settings';
import { AppContext, type AppContextValue } from './ui/appContext';
import { GameScreen } from './ui/screens/GameScreen';
import { RecordsScreen } from './ui/screens/RecordsScreen';
import { ResultScreen } from './ui/screens/ResultScreen';
import { SettingsScreen } from './ui/screens/SettingsScreen';
import { SongSelectScreen } from './ui/screens/SongSelectScreen';
import { TitleScreen } from './ui/screens/TitleScreen';

type Screen =
  | { name: 'title' }
  | { name: 'select' }
  | { name: 'records' }
  | { name: 'settings' }
  | { name: 'game'; songId: string; difficulty: DifficultyId; attempt: number }
  | { name: 'result'; result: PlayResult; saved: SaveOutcome };

export function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [records, setRecords] = useState(loadRecords);
  const [started, setStarted] = useState(false);
  const [screen, setScreen] = useState<Screen>({ name: 'title' });

  useEffect(() => {
    audio.setVolumes({ master: settings.masterVolume, music: settings.musicVolume, sfx: settings.sfxVolume });
  }, [settings.masterVolume, settings.musicVolume, settings.sfxVolume]);

  // Browsers only allow audio after a user gesture: unlock on the first one, wherever it happens.
  useEffect(() => {
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);
  const refreshRecords = useCallback(() => setRecords(loadRecords()), []);
  const sfx = useCallback((name: SfxName) => audio.playSfx(name), []);
  const ctx = useMemo<AppContextValue>(
    () => ({ settings, updateSettings, records, refreshRecords, sfx }),
    [settings, updateSettings, records, refreshRecords, sfx],
  );

  const go = useCallback((next: Screen) => {
    if (next.name !== 'game') audio.playSfx('transition', { gain: 0.5 });
    setScreen(next);
  }, []);

  const play = useCallback(
    (songId: string, difficulty: DifficultyId) => {
      updateSettings({ lastSongId: songId, lastDifficulty: difficulty });
      audio.stopPreview();
      setScreen((s) => ({ name: 'game', songId, difficulty, attempt: s.name === 'game' ? s.attempt + 1 : 0 }));
    },
    [updateSettings],
  );

  const quickPlay = () => {
    const song = getSong(settings.lastSongId) ?? getSong('midnight-drive');
    const diff = isDifficultyId(settings.lastDifficulty) ? settings.lastDifficulty : 'normal';
    if (song) play(song.id, song.difficulties[diff] ? diff : 'normal');
  };

  const onFinish = useCallback(
    (result: PlayResult) => {
      const saved = saveResult(result);
      refreshRecords();
      setScreen({ name: 'result', result, saved });
    },
    [refreshRecords],
  );

  const start = useCallback(() => {
    audio.unlock();
    audio.playSfx('menuSelect');
    setStarted(true);
    // Warm the cache so PLAY starts instantly.
    const last = getSong(settings.lastSongId);
    if (last) void audio.loadSong(last);
  }, [settings.lastSongId]);

  let body: ReactNode;
  let key: string = screen.name;
  switch (screen.name) {
    case 'title':
      body = (
        <TitleScreen
          started={started}
          onStart={start}
          onQuickPlay={quickPlay}
          onSongSelect={() => go({ name: 'select' })}
          onRecords={() => go({ name: 'records' })}
          onSettings={() => go({ name: 'settings' })}
        />
      );
      break;
    case 'select':
      body = (
        <SongSelectScreen
          initialSongId={settings.lastSongId}
          initialDifficulty={isDifficultyId(settings.lastDifficulty) ? settings.lastDifficulty : 'normal'}
          onStart={play}
          onBack={() => go({ name: 'title' })}
        />
      );
      break;
    case 'game':
      key = `game-${screen.attempt}`;
      body = (
        <GameScreen
          songId={screen.songId}
          difficulty={screen.difficulty}
          autoplay={DEBUG_AUTOPLAY}
          onFinish={onFinish}
          onRestart={() => play(screen.songId, screen.difficulty)}
          onQuit={() => go({ name: 'select' })}
        />
      );
      break;
    case 'result':
      body = (
        <ResultScreen
          result={screen.result}
          saved={screen.saved}
          onRetry={() => play(screen.result.songId, screen.result.difficulty)}
          onSongSelect={() => go({ name: 'select' })}
          onHome={() => go({ name: 'title' })}
        />
      );
      break;
    case 'records':
      body = <RecordsScreen onBack={() => go({ name: 'title' })} />;
      break;
    case 'settings':
      body = <SettingsScreen onBack={() => go({ name: 'title' })} />;
      break;
  }

  return (
    <AppContext.Provider value={ctx}>
      <div className="app" data-reduced-motion={settings.reducedMotion}>
        <div className="screen-wrap" key={key}>
          {body}
        </div>
      </div>
    </AppContext.Provider>
  );
}
