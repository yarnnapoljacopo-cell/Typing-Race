/** Keep the saved warm-up boundary when reconnecting: a server score may be
 * a few keystrokes behind the local draft. Completed chapters use a negative
 * baseline so clearing the current page does not erase their earned words. */
export function recoverWritingBaseline({ totalWords, restoredWords, storedBaseline, hasLocalDraft, freshSprint }: {
  totalWords: number;
  restoredWords: number;
  storedBaseline: number | null;
  hasLocalDraft: boolean;
  freshSprint: boolean;
}): number {
  if (freshSprint) return totalWords;
  if (hasLocalDraft && storedBaseline !== null) return Math.min(totalWords, storedBaseline);
  if (restoredWords > 0) return totalWords - restoredWords;
  return totalWords;
}

export function sprintWords(totalWords: number, baseline: number, running: boolean): number {
  return running ? Math.max(0, totalWords - baseline) : 0;
}
