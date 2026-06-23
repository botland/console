import { resetTestState } from '@/lib/mock/store';

export function resetStore(seed = true): void {
  resetTestState({ seed, persist: false });
}