'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import type { Manifiesto, AuditEntry } from '@/lib/types';

interface SSEState {
  manifiestos: Manifiesto[];
  pending: Manifiesto[];
  auditLog: AuditEntry[];
  _version: number;
}

interface UseSSEOptions {
  onUpdate?: (prev: SSEState | null, next: SSEState) => void;
}

export function useSSE(options?: UseSSEOptions) {
  const [data, setData] = useState<SSEState | null>(null);
  const [connected, setConnected] = useState(false);
  const prevDataRef = useRef<SSEState | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource('/api/events');
    eventSourceRef.current = es;

    es.onopen = () => {
      setConnected(true);
    };

    const handleData = (e: MessageEvent) => {
      try {
        const newData: SSEState = JSON.parse(e.data);
        const prev = prevDataRef.current;
        prevDataRef.current = newData;
        setData(newData);
        optionsRef.current?.onUpdate?.(prev, newData);
      } catch {
        // ignore parse errors
      }
    };

    es.addEventListener('init', handleData);
    es.addEventListener('update', handleData);

    es.onerror = () => {
      setConnected(false);
      es.close();
      // Reconnect after 2 seconds
      reconnectTimeoutRef.current = window.setTimeout(() => {
        connect();
      }, 2000);
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      eventSourceRef.current?.close();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  // Manual refresh - force a full refetch
  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/manifiestos');
      const newData = await res.json();
      prevDataRef.current = newData;
      setData(newData);
    } catch {
      // silent
    }
  }, []);

  return { data, connected, refresh };
}

// Utility: diff two states to find what changed
export function diffSSEStates(
  prev: SSEState | null,
  next: SSEState
): { type: string; detail: string }[] {
  if (!prev) return [];
  const changes: { type: string; detail: string }[] = [];

  // Check for new manifests
  const prevIds = new Set(prev.manifiestos.map(m => m.id));
  for (const m of next.manifiestos) {
    if (!prevIds.has(m.id)) {
      changes.push({ type: 'manifest_added', detail: `Manifiesto ${m.numero} agregado` });
    }
  }

  // Check for deleted manifests
  const nextIds = new Set(next.manifiestos.map(m => m.id));
  for (const m of prev.manifiestos) {
    if (!nextIds.has(m.id)) {
      changes.push({ type: 'manifest_deleted', detail: `Manifiesto ${m.numero} eliminado` });
    }
  }

  // Check for guide check changes
  const prevGuias = new Map<string, boolean>();
  for (const m of [...prev.manifiestos, ...prev.pending]) {
    for (const g of m.guias) {
      prevGuias.set(`${m.id}:${g.numero}`, g.checked);
    }
  }

  for (const m of [...next.manifiestos, ...next.pending]) {
    for (const g of m.guias) {
      const key = `${m.id}:${g.numero}`;
      const wasChecked = prevGuias.get(key);
      if (wasChecked !== undefined && wasChecked !== g.checked) {
        changes.push({
          type: g.checked ? 'guia_checked' : 'guia_unchecked',
          detail: `Guia ${g.numero} ${g.checked ? 'confirmada' : 'desmarcada'}`,
        });
      }
    }
  }

  return changes;
}
