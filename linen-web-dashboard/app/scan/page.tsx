'use client';

import { useCallback, useRef, useState } from 'react';

import { Nav } from '@/components/nav';
import { Protected } from '@/components/protected';
import { getAllItems, getItemByTag, logTheftAlert, saveLinenItem, type LinenItem } from '@/data/linen-data';
import { useReader, type ReaderMode } from '@/hooks/use-reader';
import { checkTag } from '@/lib/detector';

// The kinds of linen items a simulated scan can produce - mirrors the
// desktop app's main.py ITEM_TYPES exactly, for the same reason (see
// resolveItemType() below).
const ITEM_TYPES = ['Bath Towel', 'Hand Towel', 'Washcloth', 'Bedsheet', 'Pillowcase', 'Blanket'];

/**
 * Decide what kind of item a scanned tag represents.
 *
 * PLACEHOLDER: a real UHF tag typically only carries a Tag ID (its
 * EPC) - not a human-readable item type - so this needs a real answer
 * once hardware is chosen: either staff pick the type at registration
 * time (a dropdown here), or item type is looked up from a separate
 * tag_id -> item_type mapping maintained elsewhere. Until that's
 * decided, this guesses randomly - same placeholder, same reasoning,
 * as the desktop app's main.py::_resolve_item_type().
 */
function resolveItemType(): string {
  return ITEM_TYPES[Math.floor(Math.random() * ITEM_TYPES.length)];
}

async function generateTagId(pendingTagIds: string[]): Promise<string> {
  const allItems = await getAllItems();
  const takenTagIds = new Set([...pendingTagIds, ...allItems.map((item) => item.tagId)]);
  let tagId: string;
  do {
    tagId = `TAG${String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')}`;
  } while (takenTagIds.has(tagId));
  return tagId;
}

export default function ScanPage() {
  return (
    <Protected>
      <Nav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-9">
        <div className="mb-7">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Scan</h1>
          <p className="mt-0.5 text-sm text-slate-400">
            Register new items and run the exit-scanner theft check, right from this browser.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <RegisterSection />
          <ExitScannerSection />
        </div>
      </main>
    </Protected>
  );
}

/** Small badge row for switching a checkpoint between Simulated and Web Serial. */
function ReaderModeSwitch({
  mode,
  connecting,
  webSerialSupported,
  onConnectSerial,
  onDisconnectSerial,
}: {
  mode: ReaderMode;
  connecting: boolean;
  webSerialSupported: boolean;
  onConnectSerial: () => void;
  onDisconnectSerial: () => void;
}) {
  if (mode === 'web-serial') {
    return (
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700">
          <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
          Reader connected
        </span>
        <button
          onClick={onDisconnectSerial}
          className="text-xs font-medium text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={onConnectSerial}
      disabled={connecting || !webSerialSupported}
      title={
        webSerialSupported
          ? 'Connect a real USB RFID reader via Web Serial'
          : 'Web Serial needs Chrome or Edge'
      }
      className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {connecting ? 'Connecting…' : 'Connect real reader'}
    </button>
  );
}

function RegisterSection() {
  const [pending, setPending] = useState<{ tagId: string; itemType: string }[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleTag = useCallback((tagId: string) => {
    setPending((current) => {
      if (current.some((p) => p.tagId === tagId)) return current; // ignore duplicate reads of the same tag
      return [...current, { tagId, itemType: resolveItemType() }];
    });
    setStatus(`Scanned ${tagId}. Added to pending list.`);
  }, []);

  const reader = useReader('entry_reader', handleTag);

  async function handleScanClick() {
    setScanning(true);
    try {
      const tagId = await generateTagId(pending.map((p) => p.tagId));
      reader.simulateScan(tagId);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to generate a tag ID.');
    } finally {
      setScanning(false);
    }
  }

  function removePending(tagId: string) {
    setPending((current) => current.filter((p) => p.tagId !== tagId));
  }

  async function handleAssign() {
    if (pending.length === 0) {
      setStatus('Scan at least one item first.');
      return;
    }
    if (!customerName.trim() || !roomNumber.trim()) {
      setStatus('Fill in Customer Name and Room Number.');
      return;
    }

    setSaving(true);
    try {
      for (const item of pending) {
        const linenItem: LinenItem = {
          tagId: item.tagId,
          customerName: customerName.trim(),
          roomNumber: roomNumber.trim(),
          itemType: item.itemType,
          status: 'In Use',
        };
        await saveLinenItem(linenItem);
      }
      setStatus(`Assigned ${pending.length} item(s) to ${customerName.trim()}.`);
      setPending([]);
      setCustomerName('');
      setRoomNumber('');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to save items.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Register items</h2>
          <p className="mt-0.5 text-sm text-slate-400">Scan a tag, then assign a guest and room.</p>
        </div>
        <ReaderModeSwitch
          mode={reader.mode}
          connecting={reader.connecting}
          webSerialSupported={reader.webSerialSupported}
          onConnectSerial={reader.connectSerial}
          onDisconnectSerial={reader.disconnectSerial}
        />
      </div>

      {reader.error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{reader.error}</p>
      )}

      {reader.mode === 'simulated' && (
        <button
          onClick={handleScanClick}
          disabled={scanning}
          className="mb-4 w-full rounded-lg border border-dashed border-teal-300 bg-teal-50/50 px-4 py-3 text-sm font-medium text-teal-700 transition-colors hover:bg-teal-50 disabled:opacity-60"
        >
          {scanning ? 'Scanning…' : '+ Scan (simulated)'}
        </button>
      )}
      {reader.mode === 'web-serial' && (
        <p className="mb-4 rounded-lg border border-dashed border-teal-300 bg-teal-50/50 px-4 py-3 text-center text-sm text-teal-700">
          Waiting for a tag - scans appear below automatically.
        </p>
      )}

      <div className="mb-4 max-h-40 overflow-y-auto rounded-lg border border-slate-200">
        {pending.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-slate-400">No items scanned yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {pending.map((item) => (
              <li key={item.tagId} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>
                  <span className="font-mono text-slate-700">{item.tagId}</span>
                  <span className="ml-2 text-slate-400">{item.itemType}</span>
                </span>
                <button
                  onClick={() => removePending(item.tagId)}
                  className="text-xs text-slate-400 hover:text-red-600"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Customer name</label>
          <input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/25"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Room number</label>
          <input
            value={roomNumber}
            onChange={(e) => setRoomNumber(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/25"
          />
        </div>
      </div>

      <button
        onClick={handleAssign}
        disabled={saving}
        className="w-full rounded-lg bg-teal-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm shadow-teal-600/30 transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? 'Saving…' : 'Assign'}
      </button>

      {status && <p className="mt-3 text-sm text-slate-500">{status}</p>}
    </section>
  );
}

type ScanResult = { tagId: string; flagged: boolean; item: LinenItem | null };

// How long to ignore repeat reads of the same tag after processing
// it once. A real UHF reader in continuous-inventory mode reports the
// same tag many times a second while it's in range - without this,
// one item passing the exit would log dozens of duplicate alerts
// instead of one. This is the dedup/debounce step flagged as a known
// gap for the desktop app's serial reader too (see its README) -
// implemented here since Web Serial mode makes it immediately
// relevant, rather than left as a placeholder.
const RESCAN_COOLDOWN_MS = 5000;

function ExitScannerSection() {
  const [manualTagId, setManualTagId] = useState('');
  const [processing, setProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const lastSeenRef = useRef<Map<string, number>>(new Map());

  const handleTag = useCallback(async (tagId: string) => {
    const now = Date.now();
    const lastSeen = lastSeenRef.current.get(tagId);
    if (lastSeen && now - lastSeen < RESCAN_COOLDOWN_MS) {
      return; // same tag, still within the cooldown window - ignore
    }
    lastSeenRef.current.set(tagId, now);

    setProcessing(true);
    setStatusError(null);
    try {
      const item = await getItemByTag(tagId);
      const flagged = checkTag(item);

      if (flagged) {
        const message = item
          ? `${item.itemType} (${tagId}) was detected at the exit scanner while marked ${item.status}.`
          : `Unregistered tag (${tagId}) was detected at the exit scanner.`;
        await logTheftAlert(tagId, item, message);
      }

      setLastResult({ tagId, flagged, item });
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Failed to process scan.');
    } finally {
      setProcessing(false);
    }
  }, []);

  const reader = useReader('exit_reader', handleTag);

  function handleManualSubmit() {
    const tagId = manualTagId.trim().toUpperCase();
    if (!tagId) return;
    reader.simulateScan(tagId);
    setManualTagId('');
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Exit scanner</h2>
          <p className="mt-0.5 text-sm text-slate-400">Any tag detected here is treated as leaving.</p>
        </div>
        <ReaderModeSwitch
          mode={reader.mode}
          connecting={reader.connecting}
          webSerialSupported={reader.webSerialSupported}
          onConnectSerial={reader.connectSerial}
          onDisconnectSerial={reader.disconnectSerial}
        />
      </div>

      {reader.error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{reader.error}</p>
      )}
      {statusError && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{statusError}</p>
      )}

      {reader.mode === 'simulated' && (
        <div className="mb-5 flex gap-2">
          <input
            value={manualTagId}
            onChange={(e) => setManualTagId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
            placeholder="Tag ID"
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/25"
          />
          <button
            onClick={handleManualSubmit}
            disabled={processing}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-900 disabled:opacity-60"
          >
            Scan
          </button>
        </div>
      )}
      {reader.mode === 'web-serial' && (
        <p className="mb-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-center text-sm text-slate-500">
          Waiting for a tag - the exit check runs automatically.
        </p>
      )}

      {lastResult ? (
        <div
          className={`rounded-xl border px-5 py-4 ${
            lastResult.flagged ? 'border-red-200/70 bg-red-50/60' : 'border-teal-200/70 bg-teal-50/60'
          }`}
        >
          <p className={`font-semibold ${lastResult.flagged ? 'text-red-900' : 'text-teal-800'}`}>
            {lastResult.flagged ? '⚠ Theft alert' : '✓ Cleared'}
          </p>
          <p className={`mt-1 text-sm ${lastResult.flagged ? 'text-red-700/90' : 'text-teal-700/90'}`}>
            Tag <span className="font-mono">{lastResult.tagId}</span>
            {lastResult.item
              ? ` · ${lastResult.item.itemType} · Room ${lastResult.item.roomNumber} · ${lastResult.item.customerName} · ${lastResult.item.status}`
              : ' · not registered'}
          </p>
        </div>
      ) : (
        <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 px-5 py-10 text-sm text-slate-400">
          No scans yet.
        </div>
      )}
    </section>
  );
}
