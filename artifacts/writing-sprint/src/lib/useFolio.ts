import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/react";
import { useAuthedFetch } from "./authedFetch";
import { folioStore, type FolioState, type FolioConflict } from "./folioStore";

export function useFolio() {
  const [, bump] = useState(0);
  const { isSignedIn } = useAuth();
  const authedFetch = useAuthedFetch();

  useEffect(() => {
    if (isSignedIn && authedFetch) {
      folioStore.configure(authedFetch);
    }
  }, [isSignedIn, authedFetch]);

  useEffect(() => {
    return folioStore.subscribe(() => bump((n) => n + 1));
  }, []);

  const setState = useCallback(
    (updater: FolioState | ((prev: FolioState) => FolioState)) => {
      folioStore.setState(updater);
    },
    [],
  );

  const resolveConflict = useCallback(
    (docId: string, choice: "local" | "remote") => {
      folioStore.resolveConflict(docId, choice);
    },
    [],
  );

  return {
    state: folioStore.getState(),
    setState,
    isOnline: folioStore.isOnline,
    isSyncing: folioStore.isSyncing,
    isInitialized: folioStore.isInitialized,
    lastSyncError: folioStore.lastSyncError,
    syncNow: () => folioStore.pushToServer(),
    conflicts: folioStore.conflicts as FolioConflict[],
    resolveConflict,
  };
}
