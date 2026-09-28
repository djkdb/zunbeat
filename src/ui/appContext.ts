import { createContext, useContext } from 'react';
import type { SfxName } from '../game/audio/synth/renderSfx';
import type { RecordsData } from '../storage/records';
import type { Settings } from '../storage/settings';

export interface AppContextValue {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  records: RecordsData;
  refreshRecords: () => void;
  sfx: (name: SfxName) => void;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppContext.Provider>');
  return ctx;
}
