/**
 * hooks/use-reader.ts
 *
 * Drains the active reader on a timer and hands each tag ID to the
 * caller - the mobile-app twin of the web dashboard's hook of the
 * same name, and conceptually the same as the desktop app's
 * main.py::_poll_readers(). Defaults to Simulated mode (always ready,
 * works on every platform including Expo Go); switching to USB mode
 * is an explicit action the Scan screen offers when supported - see
 * hardware/usb-serial-reader.ts for what that actually requires.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { RFIDReader, type ReaderRole } from '@/hardware/base';
import { SimulatedReader } from '@/hardware/simulated-reader';
import { UsbSerialReader } from '@/hardware/usb-serial-reader';

export type ReaderMode = 'simulated' | 'usb-serial';

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

  // Disconnect whatever's active if the screen unmounts, so a USB
  // connection doesn't outlive the component holding it.
  useEffect(() => {
    return () => {
      readerRef.current.disconnect().catch(() => {});
    };
  }, []);

  const connectUsbSerial = useCallback(async () => {
    setError(null);
    setConnecting(true);
    const reader = new UsbSerialReader(role);
    try {
      await reader.connect();
      reader.start();
      await readerRef.current.disconnect();
      readerRef.current = reader;
      setMode('usb-serial');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to reader.');
    } finally {
      setConnecting(false);
    }
  }, [role]);

  const disconnectUsbSerial = useCallback(async () => {
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
    usbSerialSupported: UsbSerialReader.isSupported(),
    connectUsbSerial,
    disconnectUsbSerial,
    simulateScan,
  };
}
