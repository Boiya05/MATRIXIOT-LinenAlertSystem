/**
 * hooks/use-reader.ts
 *
 * The browser-side equivalent of the desktop app's
 * main.py::_poll_readers() + _connect_reader() - drains whichever
 * reader is currently active on a timer and hands each tag ID to the
 * caller. Defaults to Simulated mode (always "connected", no setup
 * needed) since that's the only mode guaranteed to work in every
 * browser; switching to Web Serial is an explicit action the scan
 * page offers when supported.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { RFIDReader, type ReaderRole } from '@/hardware/base';
import { SimulatedReader } from '@/hardware/simulated-reader';
import { WebSerialReader } from '@/hardware/web-serial-reader';

export type ReaderMode = 'simulated' | 'web-serial';

export function useReader(role: ReaderRole, onTag: (tagId: string) => void) {
  const [mode, setMode] = useState<ReaderMode>('simulated');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const readerRef = useRef<RFIDReader>(new SimulatedReader(role));

  // Keeps the poll loop's closure current without having to restart
  // the interval every time the caller's onTag callback changes.
  const onTagRef = useRef(onTag);
  onTagRef.current = onTag;

  useEffect(() => {
    const interval = setInterval(() => {
      const tagIds = readerRef.current.poll();
      for (const tagId of tagIds) onTagRef.current(tagId);
    }, 150);
    return () => clearInterval(interval);
  }, []);

  // Disconnect whatever's active if the page unmounts, so a Web
  // Serial connection doesn't outlive the component holding it.
  useEffect(() => {
    return () => {
      readerRef.current.disconnect().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectSerial = useCallback(async () => {
    setError(null);
    setConnecting(true);
    const reader = new WebSerialReader(role);
    try {
      await reader.connect();
      reader.start();
      await readerRef.current.disconnect();
      readerRef.current = reader;
      setMode('web-serial');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to reader.');
    } finally {
      setConnecting(false);
    }
  }, [role]);

  const disconnectSerial = useCallback(async () => {
    await readerRef.current.disconnect();
    readerRef.current = new SimulatedReader(role);
    setMode('simulated');
    setError(null);
  }, [role]);

  const simulateScan = useCallback((tagId: string) => {
    if (readerRef.current instanceof SimulatedReader) {
      readerRef.current.simulateScan(tagId);
    }
  }, []);

  return {
    mode,
    connecting,
    error,
    webSerialSupported: WebSerialReader.isSupported(),
    connectSerial,
    disconnectSerial,
    simulateScan,
  };
}
