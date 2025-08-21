import React, { createContext, useContext, useState } from 'react';
import { fetchSnapshot } from '../api/gitviz';

const SnapshotContext = createContext(null);

export function SnapshotProvider({ children }) {
  const [repo, setRepo] = useState('');
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function loadSnapshot(options = {}) {
    const payload = {
      repo: options.repo ?? repo,
      top: options.top ?? 10,
      since: options.since,
      until: options.until,
      fullHistory: options.fullHistory,
    };
    setLoading(true); setError(null);
    try {
      const data = await fetchSnapshot(payload);
      setSnapshot(data);
      if (payload.repo) setRepo(payload.repo);
      return data;
    } catch (e) {
      setError(e.message || String(e));
      throw e;
    } finally {
      setLoading(false);
    }
  }

  return (
    <SnapshotContext.Provider value={{ repo, setRepo, snapshot, loadSnapshot, loading, error }}>
      {children}
    </SnapshotContext.Provider>
  );
}

export function useSnapshot() {
  const ctx = useContext(SnapshotContext);
  if (!ctx) throw new Error('useSnapshot must be used within SnapshotProvider');
  return ctx;
}
