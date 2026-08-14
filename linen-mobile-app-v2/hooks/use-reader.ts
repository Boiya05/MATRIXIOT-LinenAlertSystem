/**
 * hooks/use-reader.ts
 *
 * Drains the active reader on a timer and hands each tag ID to the
 * caller - the mobile-app twin of the web dashboard's hook of the
 * same name, and conceptually the same as the desktop app's
 * main.py::_poll_readers(). Only Simulated mode exists today - see
 * hardware/README.md for why there's no real-reader mode yet.
 */

import { useCallback, useEffect, useRef } from 'react';

import { RFIDReader, type ReaderRole } from '@/hardware/base';
import { SimulatedReader } from '@/hardware/simulated-reader';

export function useReader(role: ReaderRole, onTag: (tagId: string) => void) {
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

  const simulateScan = useCallback((tagId: string) => {
    if (readerRef.current instanceof SimulatedReader) {
      readerRef.current.simulateScan(tagId);
    }
  }, []);

  return { simulateScan };
}
