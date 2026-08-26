'use client';

import { useCallback, useRef, useState } from 'react';

import { Nav } from '@/components/nav';
import { Protected } from '@/components/protected';
import { useAuth } from '@/contexts/auth-context';
import { getItemByTag, logItemEvent, logTheftAlert, saveLinenItem, type LinenItem } from '@/data/linen-data';
import { useReader, type ReaderMode } from '@/hooks/use-reader';
import { checkTag } from '@/lib/detector';

/**
 * Shown at the top of a Scan section for a signed-in `viewer` account
 * - every account can watch this page live, but registering items,
 * running the exit scanner, and dismissing alerts are staff-only (see
 * the mobile app's README, "Role-based permissions"). This is the
 * proactive version of that gate; data/linen-data.ts's
 * friendlyWriteError is the fallback for anywhere a click still gets
 * through to Supabase's Row Level Security.
 */
function ViewerNotice() {
  return (
    <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-400">
      👀 You&apos;re signed in as a viewer. Ask an admin for staff access to use this.
    </p>
  );
}

// The kinds of linen items this app tracks - mirrors the desktop
// app's main.py ITEM_TYPES exactly. A real UHF tag only carries a Tag
// ID (its EPC), not a human-readable item type, so staff pick it from
// this list at scan time (the dropdown in RegisterSection below)
// rather than it being guessed or looked up automatically.
const ITEM_TYPES = ['Bath Towel', 'Hand Towel', 'Washcloth', 'Bedsheet', 'Pillowcase', 'Blanket'];

export default function ScanPage() {
  return (
    <Protected>
      <Nav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-9">
        <div className="mb-7 animate-fade-in-up">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Scan
          </h1>
          <p className="mt-0.5 text-sm text-slate-400 dark:text-slate-500">
            Register new items, assign them to a guest, and run the exit-scanner theft check -
            right from this browser.
          </p>
        </div>
        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <div className="animate-fade-in-up">
            <RegisterSection />
          </div>
          <div className="animate-fade-in-up" style={{ animationDelay: '80ms' }}>
            <AssignToGuestSection />
          </div>
        </div>
        <div className="animate-fade-in-up" style={{ animationDelay: '140ms' }}>
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
        <span className="flex items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700 dark:bg-teal-500/10 dark:text-teal-400">
          <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
          Reader connected
        </span>
        <button
          onClick={onDisconnectSerial}
          className="text-xs font-medium text-slate-400 underline-offset-2 transition-colors hover:text-slate-600 hover:underline dark:text-slate-500 dark:hover:text-slate-300"
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
      className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
    >
      {connecting ? 'Connecting…' : 'Connect real reader'}
    </button>
  );
}

function RegisterSection() {
  const { isStaff, roleLoading } = useAuth();
  const [pending, setPending] = useState<{ tagId: string; itemType: string }[]>([]);
  const [selectedItemType, setSelectedItemType] = useState(ITEM_TYPES[0]);
  const [manualTagId, setManualTagId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Depends on selectedItemType so a fresh closure (carrying the
  // currently-picked type) reaches useReader's poll loop every time
  // the selection changes - see hooks/use-reader.ts's onTagRef, which
  // is refreshed every render specifically so this works.
  const handleTag = useCallback(
    (tagId: string) => {
      setPending((current) => {
        if (current.some((p) => p.tagId === tagId)) return current; // ignore duplicate reads of the same tag
        return [...current, { tagId, itemType: selectedItemType }];
      });
      setStatus(`Scanned ${tagId}. Added to pending list.`);
    },
    [selectedItemType]
  );

  const reader = useReader('entry_reader', handleTag);

  // A real USB RFID reader is a "keyboard wedge" - it types the tag
  // ID as keystrokes into whatever's focused, then sends Enter, no
  // different from someone typing it by hand. Feeds into the same
  // queue useReader's poll loop drains either way, so handleTag above
  // (with its duplicate-scan check) is still the one processing path.
  function handleManualSubmit() {
    if (!isStaff) return; // matches the button's disabled state - Enter shouldn't bypass it
    const tagId = manualTagId.trim().toUpperCase();
    if (!tagId) return;
    reader.simulateScan(tagId);
    setManualTagId('');
  }

  function removePending(tagId: string) {
    setPending((current) => current.filter((p) => p.tagId !== tagId));
  }

  async function handleSave() {
    if (pending.length === 0) {
      setStatus('Scan at least one item first.');
      return;
    }

    // Customer/room are optional - leave them blank to register tags
    // as unassigned stock, sorted into categories by Item Type alone
    // (status 'Storage', matching what that status already means:
    // "not currently with any customer"). Fill them in to assign a
    // guest right away instead, same one-step flow as before. Either
    // way, use the "Assign to guest" section later to attach a guest
    // to stock that was registered without one.
    const trimmedCustomer = customerName.trim();
    const trimmedRoom = roomNumber.trim();
    const assigningNow = trimmedCustomer !== '' || trimmedRoom !== '';

    setSaving(true);
    try {
      for (const item of pending) {
        const linenItem: LinenItem = {
          tagId: item.tagId,
          customerName: trimmedCustomer,
          roomNumber: trimmedRoom,
          itemType: item.itemType,
          status: assigningNow ? 'In Use' : 'Storage',
        };
        await saveLinenItem(linenItem);
        logItemEvent({
          tagId: linenItem.tagId,
          eventType: 'registered',
          newStatus: linenItem.status,
          customerName: linenItem.customerName || null,
          roomNumber: linenItem.roomNumber || null,
          detail: linenItem.itemType,
        }).catch((err) => console.warn('Failed to log audit event:', err));
      }
      setStatus(
        assigningNow
          ? `✅ Registered and assigned ${pending.length} item(s) to ${trimmedCustomer}.`
          : `✅ Registered ${pending.length} item(s) as unassigned stock.`
      );
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
    <section className="h-full rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-200/50 transition-shadow hover:shadow-md hover:shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20 dark:hover:shadow-black/40">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            📝 Register items
          </h2>
          <p className="mt-0.5 text-sm text-slate-400 dark:text-slate-500">
            Scan tags into a category. Guest and room are optional here - assign them now, or
            later in &quot;Assign to guest&quot;.
          </p>
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
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
          {reader.error}
        </p>
      )}
      {!roleLoading && !isStaff && <ViewerNotice />}

      <div className="mb-3">
        <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
          Item type - applies to the next tag scanned
        </label>
        <select
          value={selectedItemType}
          onChange={(e) => setSelectedItemType(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-teal-500/20"
        >
          {ITEM_TYPES.map((itemType) => (
            <option key={itemType} value={itemType}>
              {itemType}
            </option>
          ))}
        </select>
      </div>

      {reader.mode === 'simulated' && (
        <div className="mb-4 flex gap-2">
          <input
            value={manualTagId}
            onChange={(e) => setManualTagId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
            placeholder="Scan or type Tag ID"
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:ring-teal-500/20"
          />
          <button
            onClick={handleManualSubmit}
            disabled={!isStaff}
            title={!isStaff ? 'Staff access required' : undefined}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-teal-700 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Scan
          </button>
        </div>
      )}
      {reader.mode === 'web-serial' && (
        <p className="mb-4 rounded-lg border border-dashed border-teal-300 bg-teal-50/50 px-4 py-3 text-center text-sm text-teal-700 dark:border-teal-500/30 dark:bg-teal-500/5 dark:text-teal-400">
          Waiting for a tag - scans appear below automatically.
        </p>
      )}

      <div className="mb-4 max-h-40 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800">
        {pending.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-slate-400 dark:text-slate-500">
            No items scanned yet.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {pending.map((item) => (
              <li key={item.tagId} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{item.tagId}</span>
                  <span className="ml-2 text-slate-400 dark:text-slate-500">{item.itemType}</span>
                </span>
                <button
                  onClick={() => removePending(item.tagId)}
                  className="text-xs text-slate-400 transition-colors hover:text-red-600 dark:text-slate-500 dark:hover:text-red-400"
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
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
            Customer name (optional)
          </label>
          <input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:ring-teal-500/20"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
            Room number (optional)
          </label>
          <input
            value={roomNumber}
            onChange={(e) => setRoomNumber(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:ring-teal-500/20"
          />
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving || !isStaff}
        title={!isStaff ? 'Staff access required' : undefined}
        className="w-full rounded-lg bg-gradient-to-b from-teal-500 to-teal-600 px-3 py-2.5 text-sm font-semibold text-white shadow-md shadow-teal-600/30 transition-all hover:shadow-lg hover:shadow-teal-600/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100"
      >
        {saving ? 'Saving…' : pending.length > 0 && (customerName.trim() || roomNumber.trim()) ? 'Save & assign' : 'Save'}
      </button>

      {status && <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{status}</p>}
    </section>
  );
}

/**
 * The other half of Register items' optional-guest flow: scan any
 * number of already-registered tags (whether left unassigned on
 * purpose, or being handed to a different guest than before), then
 * attach one Customer Name + Room Number to all of them at once -
 * same batch pattern as Register items' pending list. Doesn't touch
 * Item Type - that was already decided at registration.
 */
function AssignToGuestSection() {
  const { isStaff, roleLoading } = useAuth();
  const [manualTagId, setManualTagId] = useState('');
  const [looking, setLooking] = useState(false);
  const [pending, setPending] = useState<LinenItem[]>([]);
  const [notFoundTagId, setNotFoundTagId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleLookup() {
    if (!isStaff) return;
    const tagId = manualTagId.trim().toUpperCase();
    if (!tagId) return;

    setManualTagId('');
    if (pending.some((item) => item.tagId === tagId)) {
      setStatus(`${tagId} is already in the list.`);
      return; // already queued - don't re-fetch or add it twice
    }

    setLooking(true);
    setStatus(null);
    setNotFoundTagId(null);
    try {
      const item = await getItemByTag(tagId);
      if (!item) {
        setNotFoundTagId(tagId);
      } else {
        setPending((current) => [...current, item]);
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to look up tag.');
    } finally {
      setLooking(false);
    }
  }

  function removePending(tagId: string) {
    setPending((current) => current.filter((item) => item.tagId !== tagId));
  }

  async function handleAssign() {
    if (!isStaff || pending.length === 0) return;
    const trimmedCustomer = customerName.trim();
    const trimmedRoom = roomNumber.trim();
    if (!trimmedCustomer || !trimmedRoom) {
      setStatus('Fill in Customer Name and Room Number.');
      return;
    }

    setSaving(true);
    try {
      for (const item of pending) {
        const updated: LinenItem = {
          ...item,
          customerName: trimmedCustomer,
          roomNumber: trimmedRoom,
          status: 'In Use',
        };
        await saveLinenItem(updated);
        logItemEvent({
          tagId: updated.tagId,
          eventType: 'status_changed',
          oldStatus: item.status,
          newStatus: 'In Use',
          customerName: trimmedCustomer,
          roomNumber: trimmedRoom,
          detail: updated.itemType,
        }).catch((err) => console.warn('Failed to log audit event:', err));
      }
      setStatus(`✅ Assigned ${pending.length} item(s) to ${trimmedCustomer}.`);
      setPending([]);
      setCustomerName('');
      setRoomNumber('');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to assign items.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="h-full rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-200/50 transition-shadow hover:shadow-md hover:shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20 dark:hover:shadow-black/40">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          🙋 Assign to guest
        </h2>
        <p className="mt-0.5 text-sm text-slate-400 dark:text-slate-500">
          Scan already-registered tags, then assign them all to one guest and room at once.
        </p>
      </div>

      {!roleLoading && !isStaff && <ViewerNotice />}

      <div className="mb-3 flex gap-2">
        <input
          value={manualTagId}
          onChange={(e) => setManualTagId(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
          placeholder="Scan or type Tag ID"
          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:ring-teal-500/20"
        />
        <button
          onClick={handleLookup}
          disabled={looking || !isStaff}
          title={!isStaff ? 'Staff access required' : undefined}
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-900 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-700 dark:hover:bg-slate-600"
        >
          {looking ? 'Looking…' : 'Add'}
        </button>
      </div>

      {notFoundTagId && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
          Tag <span className="font-mono">{notFoundTagId}</span> isn&apos;t registered yet -
          register it in Register items first.
        </p>
      )}

      <div className="mb-4 max-h-40 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800">
        {pending.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-slate-400 dark:text-slate-500">
            No items scanned yet.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {pending.map((item) => (
              <li key={item.tagId} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{item.tagId}</span>
                  <span className="ml-2 text-slate-400 dark:text-slate-500">
                    {item.itemType} · {item.status}
                    {item.customerName ? ` · ${item.customerName}` : ''}
                  </span>
                </span>
                <button
                  onClick={() => removePending(item.tagId)}
                  className="text-xs text-slate-400 transition-colors hover:text-red-600 dark:text-slate-500 dark:hover:text-red-400"
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
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
            Customer name
          </label>
          <input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:ring-teal-500/20"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
            Room number
          </label>
          <input
            value={roomNumber}
            onChange={(e) => setRoomNumber(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:ring-teal-500/20"
          />
        </div>
      </div>

      <button
        onClick={handleAssign}
        disabled={saving || !isStaff}
        title={!isStaff ? 'Staff access required' : undefined}
        className="w-full rounded-lg bg-gradient-to-b from-teal-500 to-teal-600 px-3 py-2.5 text-sm font-semibold text-white shadow-md shadow-teal-600/30 transition-all hover:shadow-lg hover:shadow-teal-600/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100"
      >
        {saving ? 'Assigning…' : pending.length > 1 ? `Assign ${pending.length} items` : 'Assign'}
      </button>

      {status && <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{status}</p>}
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
  const { isStaff, roleLoading } = useAuth();
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

      // checkTag() only ever returns true for a registered item (see
      // its own comment for why unregistered tags aren't flagged at
      // all) - `item` is guaranteed non-null here, `&& item` is just
      // to satisfy the type checker.
      if (flagged && item) {
        const message = `${item.itemType} (${tagId}) was detected at the exit scanner while marked ${item.status}.`;
        await logTheftAlert(tagId, item, message);
        logItemEvent({
          tagId,
          eventType: 'alert_triggered',
          oldStatus: item.status,
          customerName: item.customerName,
          roomNumber: item.roomNumber,
          detail: item.itemType,
        }).catch((err) => console.warn('Failed to log audit event:', err));
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
    if (!isStaff) return; // matches the button's disabled state - Enter shouldn't bypass it
    const tagId = manualTagId.trim().toUpperCase();
    if (!tagId) return;
    reader.simulateScan(tagId);
    setManualTagId('');
  }

  return (
    <section className="h-full rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-200/50 transition-shadow hover:shadow-md hover:shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20 dark:hover:shadow-black/40">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            🚪 Exit scanner
          </h2>
          <p className="mt-0.5 text-sm text-slate-400 dark:text-slate-500">
            Any tag detected here is treated as leaving.
          </p>
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
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
          {reader.error}
        </p>
      )}
      {statusError && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
          {statusError}
        </p>
      )}
      {!roleLoading && !isStaff && <ViewerNotice />}

      {reader.mode === 'simulated' && (
        <div className="mb-5 flex gap-2">
          <input
            value={manualTagId}
            onChange={(e) => setManualTagId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
            placeholder="Tag ID"
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:ring-teal-500/20"
          />
          <button
            onClick={handleManualSubmit}
            disabled={processing || !isStaff}
            title={!isStaff ? 'Staff access required' : undefined}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-900 active:scale-[0.97] disabled:opacity-60 dark:bg-slate-700 dark:hover:bg-slate-600"
          >
            Scan
          </button>
        </div>
      )}
      {reader.mode === 'web-serial' && (
        <p className="mb-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
          Waiting for a tag - the exit check runs automatically.
        </p>
      )}

      {lastResult ? (
        <div
          key={`${lastResult.tagId}-${lastResult.flagged}`}
          className={`animate-fade-in-up rounded-xl border px-5 py-4 shadow-sm ${
            lastResult.flagged
              ? 'border-red-200/70 bg-red-50/60 shadow-red-900/5 dark:border-red-500/20 dark:bg-red-500/[0.07] dark:shadow-none'
              : 'border-teal-200/70 bg-teal-50/60 shadow-teal-900/5 dark:border-teal-500/20 dark:bg-teal-500/[0.07] dark:shadow-none'
          }`}
        >
          <p
            className={`font-semibold ${
              lastResult.flagged ? 'text-red-900 dark:text-red-300' : 'text-teal-800 dark:text-teal-300'
            }`}
          >
            {lastResult.flagged ? '🚨 Theft alert' : '✅ Cleared'}
          </p>
          <p
            className={`mt-1 text-sm ${
              lastResult.flagged ? 'text-red-700/90 dark:text-red-400/90' : 'text-teal-700/90 dark:text-teal-400/90'
            }`}
          >
            Tag <span className="font-mono">{lastResult.tagId}</span>
            {lastResult.item
              ? ` · ${lastResult.item.itemType} · Room ${lastResult.item.roomNumber} · ${lastResult.item.customerName} · ${lastResult.item.status}`
              : ' · not registered'}
          </p>
        </div>
      ) : (
        <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 px-5 py-10 text-sm text-slate-400 dark:border-slate-800 dark:text-slate-500">
          No scans yet.
        </div>
      )}
    </section>
  );
}
