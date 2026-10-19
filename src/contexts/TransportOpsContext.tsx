/**
 * TransportOpsContext — transport-operations domain state ONLY (slice 1: vehicles, trips, vehicle expenses).
 *
 * Composes the core, never forks it (same shape as LabourDataContext): FY-lock and the voucher engine come
 * from useData(); every trip / collection / expense is ONE voucher posted through useData().addVoucher, so
 * the server posting service (post_voucher) writes it. The document row is the vehicle tag
 * (voucher.refType / refId → document → vehicle; see src/lib/transport/vehicleProfit.ts).
 *
 * Save order (RULE 1): the voucher first; the document row is upserted only once the voucher is durably
 * saved (addVoucher onSaved). A refused voucher removes the optimistic row (onFailed); a refused row
 * cancels the voucher (viaParent) — the books never keep half a document. Every mutation is FY-lock
 * guarded (RULE 6); deletes cascade to the document's vouchers (RULE 3).
 */
import { createContext, useContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { findVoucherOwner, type OwnerGroup } from '@/lib/voucherOwnership';
import { useCapabilityEnabled } from '@/contexts/useCapabilityEnabled';
import { refuseIfWriteBlocked } from '@/lib/connectivity/writeBlock';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { fetchAllPaged } from '@/lib/supabasePaging';
import { resolveJurisdiction } from '@/lib/jurisdiction';
import { isMissingTableError } from '@/lib/export/missingTable';
import * as storage from '@/lib/storage';
import { resolveTransportAccounts } from '@/lib/transport/accounts';
import { tripLegs, tripAmount, validateTripCharges, collectionLegs, tripStatus, expenseLegs, nextDocNo, round2, tripCascadeVoucherIds } from '@/lib/transport/trips';
import { TRIP_REF, TRIP_COLLECTION_REF, EXPENSE_REF } from '@/lib/transport/vehicleProfit';
import type { TransportVehicle, TransportTrip, VehicleExpense, Voucher } from '@/types';

export type NewVehicle = Omit<TransportVehicle, 'id' | 'createdAt' | 'isDeleted'>;
export interface NewTrip { date: string; vehicleId: string; customerId: string; fromPlace: string; toPlace: string; freight: number; loading?: number; detention?: number; narration?: string }
export interface NewVehicleExpense { date: string; vehicleId: string; accountId: string; amount: number; mode: 'cash' | 'bank'; bankAccountId?: string; narration?: string }

interface TransportOpsContextValue {
  vehicles: TransportVehicle[];
  addVehicle: (data: NewVehicle) => TransportVehicle;
  updateVehicle: (id: string, data: Partial<NewVehicle>) => void;
  deleteVehicle: (id: string) => void;

  trips: TransportTrip[];
  /** opts.onSaved fires once the voucher AND the trip row are in the cloud — clear the form only then. */
  addTrip: (data: NewTrip, opts?: { onSaved?: (t: TransportTrip) => void }) => TransportTrip;
  recordTripCollection: (data: { tripId: string; amount: number; tdsAmount?: number; mode: 'cash' | 'bank'; bankAccountId?: string; date: string; reference?: string }) => Voucher;
  deleteTrip: (id: string) => void;

  vehicleExpenses: VehicleExpense[];
  addVehicleExpense: (data: NewVehicleExpense, opts?: { onSaved?: (e: VehicleExpense) => void }) => VehicleExpense;
  deleteVehicleExpense: (id: string) => void;
}

const TransportOpsContext = createContext<TransportOpsContextValue | undefined>(undefined);

/** Same identity a person reads on the RC: case, spaces and dashes don't make a second vehicle. */
export const normRegNo = (s: string) => (s || '').toUpperCase().replace(/[\s\-.]/g, '');

export function TransportOpsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { society, accounts, customers, vouchers, addVoucher, cancelVoucher, registerVoucherOwner } = useData();
  const moduleOn = useCapabilityEnabled(['transport']);
  const loadSid = moduleOn ? user?.societyId : undefined;
  const { toast } = useToast();
  const toastRef = useRef(toast);
  useEffect(() => { toastRef.current = toast; }, [toast]);

  const societyId = user?.societyId || 'SOC001';
  const withSoc = <T extends object>(d: T) => ({ ...d, society_id: societyId, jurisdiction: resolveJurisdiction(society?.state) });
  const actor = () => user?.name || 'System';

  const guardFYLocked = (): boolean => {
    if (refuseIfWriteBlocked(toastRef.current)) return true;
    if (society?.fyLocked) {
      toastRef.current({ title: 'FY Locked', description: 'वित्तीय वर्ष audit-locked है — डेटा बदला नहीं जा सकता। (Cannot modify data while Financial Year is audit-locked.)', variant: 'destructive' });
      return true;
    }
    return false;
  };

  // The one place a cloud refusal becomes words. A missing table means migration 128 has not been run.
  const cloudFail = (title: string, table: string, message: string, after: string) => {
    const why = isMissingTableError(message, table)
      ? 'Supabase में migration 128 (परिवहन तालिकाएँ) अभी नहीं चला है — admin से चलवाएँ, फिर दोबारा करें।'
      : `क्लाउड में सेव नहीं हुआ — ${message}.`;
    toastRef.current({ title, description: `${why} ${after}`, variant: 'destructive', duration: 12000 });
  };

  const [vehicles, setVehiclesState] = useState<TransportVehicle[]>(() => storage.getTransportVehicles());
  const [trips, setTripsState] = useState<TransportTrip[]>(() => storage.getTransportTrips());
  const [vehicleExpenses, setExpensesState] = useState<VehicleExpense[]>(() => storage.getVehicleExpenses());
  // Refs = the latest rows, for writes that land after an await (a collection must not overwrite a newer one).
  const tripsRef = useRef(trips);
  const setTrips = (fn: (prev: TransportTrip[]) => TransportTrip[]) => setTripsState(prev => { const u = fn(prev); tripsRef.current = u; storage.setTransportTrips(u); return u; });
  const setVehicles = (fn: (prev: TransportVehicle[]) => TransportVehicle[]) => setVehiclesState(prev => { const u = fn(prev); storage.setTransportVehicles(u); return u; });
  const setExpenses = (fn: (prev: VehicleExpense[]) => VehicleExpense[]) => setExpensesState(prev => { const u = fn(prev); storage.setVehicleExpenses(u); return u; });

  // H / RULE 3: the vouchers these documents carry are cancelled through the document, not alone.
  const ownerGroupsRef = useRef<OwnerGroup[]>([]);
  ownerGroupsRef.current = [{ label: 'ट्रिप (परिवहन)', docs: trips }, { label: 'वाहन खर्च', docs: vehicleExpenses }];
  useEffect(() => registerVoucherOwner('transport', id => findVoucherOwner(ownerGroupsRef.current, id)), [registerVoucherOwner]);

  useEffect(() => {
    const sid = loadSid;
    if (!sid) { setVehiclesState([]); setTripsState([]); tripsRef.current = []; setExpensesState([]); return; }
    fetchAllPaged<TransportVehicle>('transport_vehicles', sid).then(
      ({ data, error }) => setVehiclesState(error || !data ? storage.getTransportVehicles() : (data as unknown as TransportVehicle[])),
      () => setVehiclesState(storage.getTransportVehicles()),
    );
    fetchAllPaged<TransportTrip>('transport_trips', sid).then(
      ({ data, error }) => { const t = error || !data ? storage.getTransportTrips() : (data as unknown as TransportTrip[]); tripsRef.current = t; setTripsState(t); },
      () => { const t = storage.getTransportTrips(); tripsRef.current = t; setTripsState(t); },
    );
    fetchAllPaged<VehicleExpense>('transport_vehicle_expenses', sid).then(
      ({ data, error }) => setExpensesState(error || !data ? storage.getVehicleExpenses() : (data as unknown as VehicleExpense[])),
      () => setExpensesState(storage.getVehicleExpenses()),
    );
  }, [loadSid]);

  // ── Vehicle master (no accounting) ─────────────────────────────────────────────────────────────
  const regNoTaken = (regNo: string, exceptId?: string) =>
    vehicles.some(v => !v.isDeleted && v.id !== exceptId && normRegNo(v.regNo) === normRegNo(regNo));

  const addVehicle = useCallback((data: NewVehicle): TransportVehicle => {
    const sentinel = { ...data, id: '', createdAt: '' } as TransportVehicle;
    if (guardFYLocked()) return sentinel;
    if (!data.regNo?.trim()) { toastRef.current({ title: 'नंबर डालें', description: 'वाहन का पंजीकरण नंबर ज़रूरी है।', variant: 'destructive' }); return sentinel; }
    if (regNoTaken(data.regNo)) { toastRef.current({ title: 'वाहन पहले से है', description: `${data.regNo} पहले से दर्ज है।`, variant: 'destructive', duration: 8000 }); return sentinel; }
    const v: TransportVehicle = { ...data, regNo: data.regNo.trim().toUpperCase(), id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    setVehicles(prev => [...prev, v]);
    supabase.from('transport_vehicles').upsert(withSoc(v)).then(({ error }) => {
      if (error) {
        console.error('Vehicle save error:', error.message);
        setVehicles(prev => prev.filter(x => x.id !== v.id));
        cloudFail('वाहन सेव नहीं हुआ', 'transport_vehicles', error.message, 'स्क्रीन से हटा दिया गया; दोबारा जोड़ें।');
      }
    });
    return v;
  }, [vehicles, society, user]);

  const updateVehicle = useCallback((id: string, data: Partial<NewVehicle>) => {
    if (guardFYLocked()) return;
    const old = vehicles.find(v => v.id === id);
    if (!old) return;
    if (data.regNo !== undefined) {
      if (!data.regNo.trim()) { toastRef.current({ title: 'नंबर डालें', description: 'वाहन का पंजीकरण नंबर ज़रूरी है।', variant: 'destructive' }); return; }
      if (regNoTaken(data.regNo, id)) { toastRef.current({ title: 'वाहन पहले से है', description: `${data.regNo} पहले से दर्ज है।`, variant: 'destructive', duration: 8000 }); return; }
    }
    const updated: TransportVehicle = { ...old, ...data, ...(data.regNo !== undefined ? { regNo: data.regNo.trim().toUpperCase() } : {}) };
    setVehicles(prev => prev.map(v => v.id === id ? updated : v));
    supabase.from('transport_vehicles').upsert(withSoc(updated)).then(({ error }) => {
      if (error) {
        console.error('Vehicle update error:', error.message);
        setVehicles(prev => prev.map(v => v.id === id ? old : v));
        cloudFail('बदलाव सेव नहीं हुआ', 'transport_vehicles', error.message, 'पुराना data वापस आ गया।');
      }
    });
  }, [vehicles, society, user]);

  const deleteVehicle = useCallback((id: string) => {
    if (guardFYLocked()) return;
    const old = vehicles.find(v => v.id === id);
    if (!old) return;
    // RULE 3: a vehicle with live trips / expenses is their vehicle tag — deleting it would orphan them.
    const liveTrips = trips.filter(t => !t.isDeleted && t.vehicleId === id).length;
    const liveExp = vehicleExpenses.filter(e => !e.isDeleted && e.vehicleId === id).length;
    if (liveTrips + liveExp > 0) {
      toastRef.current({ title: 'वाहन डिलीट नहीं हो सकता', description: `इस वाहन की ${liveTrips} ट्रिप और ${liveExp} खर्च दर्ज हैं — पहले वे हटाएँ, या वाहन को "निष्क्रिय" कर दें।`, variant: 'destructive', duration: 10000 });
      return;
    }
    setVehicles(prev => prev.filter(v => v.id !== id));
    supabase.from('transport_vehicles').delete().eq('id', id).then(({ error }) => {
      if (error) {
        console.error('Vehicle delete error:', error.message);
        setVehicles(prev => [...prev, old]);
        cloudFail('डिलीट सेव नहीं हुआ', 'transport_vehicles', error.message, 'वाहन वापस आ गया।');
      }
    });
  }, [vehicles, trips, vehicleExpenses, society, user]);

  // ── Trips (income) — Dr customer / Cr 4501 (+4503 loading, +4504 detention). GST: off (see lib/transport/trips) ──
  const addTrip = useCallback((data: NewTrip, opts?: { onSaved?: (t: TransportTrip) => void }): TransportTrip => {
    const sentinel = { id: '', tripNo: '', ...data, amount: 0, paidAmount: 0, status: 'unpaid', createdAt: '' } as TransportTrip;
    if (guardFYLocked()) return sentinel;
    const vehicle = vehicles.find(v => v.id === data.vehicleId && !v.isDeleted);
    if (!vehicle) { toastRef.current({ title: 'वाहन चुनें', description: 'वाहन नहीं मिला।', variant: 'destructive', duration: 8000 }); return sentinel; }
    if (vehicle.status === 'inactive') { toastRef.current({ title: 'वाहन निष्क्रिय है', description: `${vehicle.regNo} निष्क्रिय है — पहले Vehicles में सक्रिय करें।`, variant: 'destructive', duration: 8000 }); return sentinel; }
    const customer = customers.find(c => c.id === data.customerId);
    if (!customer?.accountId) { toastRef.current({ title: 'ग्राहक चुनें', description: 'ग्राहक या उसका खाता नहीं मिला।', variant: 'destructive', duration: 8000 }); return sentinel; }
    const err = validateTripCharges(data);
    if (err) { toastRef.current({ title: 'राशि जाँचें', description: err, variant: 'destructive', duration: 8000 }); return sentinel; }
    const ids = resolveTransportAccounts(accounts);
    if (!ids.freight) {
      toastRef.current({ title: 'भाड़ा आय खाता नहीं है', description: '"Freight Income" (4501) खाता chart में नहीं है — Ledger Hygiene में "डोमेन खाते बनाएँ" दबाएँ, फिर ट्रिप दर्ज करें।', variant: 'destructive', duration: 12000 });
      return sentinel;
    }
    const legs = tripLegs(customer.accountId, data, { freight: ids.freight, loading: ids.loading, detention: ids.detention });
    const amount = tripAmount(data);
    const id = crypto.randomUUID();
    const tripNo = nextDocNo('TRP', trips.map(t => t.tripNo));
    const route = `${data.fromPlace || '—'} → ${data.toPlace || '—'}`;
    // Filled right after addVoucher returns; onSaved / onFailed always fire later (async save).
    const doc: { trip?: TransportTrip } = {};
    const voucher = addVoucher({
      type: 'journal', date: data.date,
      debitAccountId: customer.accountId, creditAccountId: ids.freight, amount,
      narration: `ट्रिप भाड़ा — ${tripNo} · ${vehicle.regNo} · ${route} · ${customer.name}${data.narration ? ` · ${data.narration}` : ''}`,
      refType: TRIP_REF, refId: id,
      createdBy: actor(),
      lines: legs.map(l => ({ id: crypto.randomUUID(), ...l })),
    } as Omit<Voucher, 'id' | 'voucherNo' | 'createdAt'>, {
      onSaved: () => {
        const trip = doc.trip!;
        supabase.from('transport_trips').upsert(withSoc(trip)).then(({ error }) => {
          if (error) {
            console.error('Trip save error:', error.message);
            setTrips(prev => prev.filter(t => t.id !== id));
            cancelVoucher(trip.voucherId!, 'Trip rolled back (trip save failed)', actor(), { viaParent: true });
            cloudFail('ट्रिप सेव नहीं हुई', 'transport_trips', error.message, 'उसका वाउचर रद्द कर दिया गया; दोबारा दर्ज करें।');
            return;
          }
          opts?.onSaved?.(trip);
        });
      },
      onFailed: () => setTrips(prev => prev.filter(t => t.id !== id)),
    });
    if (!voucher.id) return sentinel;
    const trip: TransportTrip = {
      id, tripNo, date: data.date, vehicleId: vehicle.id, customerId: customer.id,
      fromPlace: data.fromPlace.trim(), toPlace: data.toPlace.trim(),
      freight: round2(Number(data.freight) || 0),
      ...(Number(data.loading) > 0 ? { loading: round2(Number(data.loading)) } : {}),
      ...(Number(data.detention) > 0 ? { detention: round2(Number(data.detention)) } : {}),
      amount, paidAmount: 0, status: 'unpaid', voucherId: voucher.id, collectionVoucherIds: [],
      ...(data.narration ? { narration: data.narration } : {}),
      createdAt: new Date().toISOString(),
    };
    doc.trip = trip;
    setTrips(prev => [...prev, trip]);
    return trip;
  }, [vehicles, customers, accounts, trips, society, user, addVoucher, cancelVoucher]);

  const recordTripCollection = useCallback((data: { tripId: string; amount: number; tdsAmount?: number; mode: 'cash' | 'bank'; bankAccountId?: string; date: string; reference?: string }): Voucher => {
    const sentinel = { id: '', voucherNo: '', type: 'receipt', date: data.date, debitAccountId: '', creditAccountId: '', amount: 0, narration: '', createdBy: '', createdAt: '' } as unknown as Voucher;
    if (guardFYLocked()) return sentinel;
    const trip = tripsRef.current.find(t => t.id === data.tripId && !t.isDeleted);
    if (!trip) { toastRef.current({ title: 'ट्रिप नहीं मिली', description: 'Trip not found', variant: 'destructive', duration: 8000 }); return sentinel; }
    const customer = customers.find(c => c.id === trip.customerId);
    if (!customer?.accountId) { toastRef.current({ title: 'ग्राहक नहीं मिला', description: 'Customer not found', variant: 'destructive', duration: 8000 }); return sentinel; }
    const cashOrBank = data.mode === 'cash' ? storage.ACCOUNT_IDS.CASH : (data.bankAccountId || storage.defaultBankAccountId(accounts) || storage.ACCOUNT_IDS.BANK);
    const tdsAccountId = accounts.some(a => a.id === '3307' && !a.isGroup) ? '3307' : null;   // TDS Receivable
    const res = collectionLegs({ outstanding: trip.amount - trip.paidAmount, amount: data.amount, tds: data.tdsAmount, cashOrBankAccountId: cashOrBank, customerAccountId: customer.accountId, tdsAccountId });
    if ('error' in res) { toastRef.current({ title: 'राशि जाँचें', description: res.error, variant: 'destructive', duration: 9000 }); return sentinel; }
    const amount = round2(Number(data.amount));
    const ref = data.reference?.trim() ? ` · Ref ${data.reference.trim()}` : '';
    let vid = '';
    const apply = (t: TransportTrip, sign: 1 | -1): TransportTrip => {
      const paid = round2(t.paidAmount + sign * amount);
      const ids = sign === 1 ? [...(t.collectionVoucherIds || []), vid] : (t.collectionVoucherIds || []).filter(x => x !== vid);
      return { ...t, paidAmount: paid, status: tripStatus(t.amount, paid), collectionVoucherIds: ids };
    };
    const voucher = addVoucher({
      type: 'receipt', date: data.date,
      debitAccountId: cashOrBank, creditAccountId: customer.accountId, amount,
      narration: `ट्रिप वसूली — ${trip.tripNo} · ${customer.name}${res.tds > 0 ? ` · TDS ₹${res.tds}` : ''}${ref}`,
      refType: TRIP_COLLECTION_REF, refId: trip.id,
      createdBy: actor(),
      lines: res.legs.map(l => ({ id: crypto.randomUUID(), ...l })),
    } as Omit<Voucher, 'id' | 'voucherNo' | 'createdAt'>, {
      onSaved: () => {
        const latest = tripsRef.current.find(t => t.id === trip.id);
        if (!latest) return;
        supabase.from('transport_trips').upsert(withSoc(latest)).then(({ error }) => {
          if (error) {
            console.error('Trip collection save error:', error.message);
            setTrips(prev => prev.map(t => t.id === trip.id ? apply(t, -1) : t));
            cancelVoucher(vid, 'Trip collection rolled back (trip update failed)', actor(), { viaParent: true });
            cloudFail('वसूली सेव नहीं हुई', 'transport_trips', error.message, 'रसीद रद्द कर दी गई; दोबारा करें।');
          }
        });
      },
      onFailed: () => setTrips(prev => prev.map(t => t.id === trip.id ? apply(t, -1) : t)),
    });
    if (!voucher.id) return sentinel;
    vid = voucher.id;
    setTrips(prev => prev.map(t => t.id === trip.id ? apply(t, 1) : t));
    return voucher;
  }, [customers, accounts, society, user, addVoucher, cancelVoucher]);

  const deleteTrip = useCallback((id: string) => {
    if (guardFYLocked()) return;
    const old = trips.find(t => t.id === id);
    if (!old) return;
    setTrips(prev => prev.filter(t => t.id !== id));
    supabase.from('transport_trips').delete().eq('id', id).then(({ error }) => {
      if (error) {
        console.error('Trip delete error:', error.message);
        setTrips(prev => [...prev, old]);
        cloudFail('डिलीट सेव नहीं हुआ', 'transport_trips', error.message, 'ट्रिप वापस आ गई।');
        return;
      }
      // RULE 3: cancel the trip voucher + every collection voucher (linked list ∪ refId, so none is missed).
      const { tripVoucherId, collectionIds } = tripCascadeVoucherIds(old, vouchers, TRIP_COLLECTION_REF);
      const okTrip = !tripVoucherId || cancelVoucher(tripVoucherId, 'Trip deleted', actor(), { viaParent: true });
      const okColl = collectionIds.map(vid => cancelVoucher(vid, 'Trip deleted (collection reversed)', actor(), { viaParent: true })).every(Boolean);
      if (!okTrip || !okColl) toastRef.current({ title: 'वाउचर रद्द नहीं हुआ', description: 'ट्रिप हट गई, पर उसका वाउचर रद्द नहीं हो सका (lock / अनुमति)। वाउचर screen से उसे रद्द करें — अब वह अनाथ है, इसलिए रद्द हो जाएगा।', variant: 'destructive', duration: 15000 });
    });
  }, [trips, vouchers, society, user, cancelVoucher]);

  // ── Vehicle expenses — Dr 57xx / Cr cash-bank ───────────────────────────────────────────────────
  const addVehicleExpense = useCallback((data: NewVehicleExpense, opts?: { onSaved?: (e: VehicleExpense) => void }): VehicleExpense => {
    const sentinel = { id: '', expenseNo: '', ...data, createdAt: '' } as VehicleExpense;
    if (guardFYLocked()) return sentinel;
    const vehicle = vehicles.find(v => v.id === data.vehicleId && !v.isDeleted);
    if (!vehicle) { toastRef.current({ title: 'वाहन चुनें', description: 'वाहन नहीं मिला।', variant: 'destructive', duration: 8000 }); return sentinel; }
    const head = accounts.find(a => a.id === data.accountId && !a.isGroup && a.type === 'expense');
    if (!head) { toastRef.current({ title: 'खर्च खाता चुनें', description: 'खर्च का खाता (expense ledger) चुनें।', variant: 'destructive', duration: 8000 }); return sentinel; }
    const cashOrBank = data.mode === 'cash' ? storage.ACCOUNT_IDS.CASH : (data.bankAccountId || storage.defaultBankAccountId(accounts) || storage.ACCOUNT_IDS.BANK);
    const legs = expenseLegs(head.id, cashOrBank, data.amount);
    if (legs.length === 0) { toastRef.current({ title: 'राशि दर्ज करें', description: 'खर्च राशि 0 से अधिक होनी चाहिए।', variant: 'destructive', duration: 8000 }); return sentinel; }
    const amount = legs[0].amount;
    const id = crypto.randomUUID();
    const expenseNo = nextDocNo('VEX', vehicleExpenses.map(e => e.expenseNo));
    const doc: { exp?: VehicleExpense } = {};
    const voucher = addVoucher({
      type: 'payment', date: data.date,
      debitAccountId: head.id, creditAccountId: cashOrBank, amount,
      narration: `वाहन खर्च — ${expenseNo} · ${vehicle.regNo} · ${head.nameHi || head.name}${data.narration ? ` · ${data.narration}` : ''}`,
      refType: EXPENSE_REF, refId: id,
      createdBy: actor(),
      lines: legs.map(l => ({ id: crypto.randomUUID(), ...l })),
    } as Omit<Voucher, 'id' | 'voucherNo' | 'createdAt'>, {
      onSaved: () => {
        const exp = doc.exp!;
        supabase.from('transport_vehicle_expenses').upsert(withSoc(exp)).then(({ error }) => {
          if (error) {
            console.error('Vehicle expense save error:', error.message);
            setExpenses(prev => prev.filter(e => e.id !== id));
            cancelVoucher(exp.voucherId!, 'Vehicle expense rolled back (save failed)', actor(), { viaParent: true });
            cloudFail('खर्च सेव नहीं हुआ', 'transport_vehicle_expenses', error.message, 'उसका वाउचर रद्द कर दिया गया; दोबारा दर्ज करें।');
            return;
          }
          opts?.onSaved?.(exp);
        });
      },
      onFailed: () => setExpenses(prev => prev.filter(e => e.id !== id)),
    });
    if (!voucher.id) return sentinel;
    const exp: VehicleExpense = {
      id, expenseNo, date: data.date, vehicleId: vehicle.id, accountId: head.id, amount, mode: data.mode,
      ...(data.mode === 'bank' ? { bankAccountId: cashOrBank } : {}),
      voucherId: voucher.id,
      ...(data.narration ? { narration: data.narration } : {}),
      createdAt: new Date().toISOString(),
    };
    doc.exp = exp;
    setExpenses(prev => [...prev, exp]);
    return exp;
  }, [vehicles, accounts, vehicleExpenses, society, user, addVoucher, cancelVoucher]);

  const deleteVehicleExpense = useCallback((id: string) => {
    if (guardFYLocked()) return;
    const old = vehicleExpenses.find(e => e.id === id);
    if (!old) return;
    setExpenses(prev => prev.filter(e => e.id !== id));
    supabase.from('transport_vehicle_expenses').delete().eq('id', id).then(({ error }) => {
      if (error) {
        console.error('Vehicle expense delete error:', error.message);
        setExpenses(prev => [...prev, old]);
        cloudFail('डिलीट सेव नहीं हुआ', 'transport_vehicle_expenses', error.message, 'खर्च वापस आ गया।');
        return;
      }
      const ok = !old.voucherId || cancelVoucher(old.voucherId, 'Vehicle expense deleted', actor(), { viaParent: true });
      if (!ok) toastRef.current({ title: 'वाउचर रद्द नहीं हुआ', description: 'खर्च हट गया, पर उसका वाउचर रद्द नहीं हो सका (lock / अनुमति)। वाउचर screen से उसे रद्द करें — अब वह अनाथ है, इसलिए रद्द हो जाएगा।', variant: 'destructive', duration: 15000 });
    });
  }, [vehicleExpenses, society, user, cancelVoucher]);

  return (
    <TransportOpsContext.Provider value={{
      vehicles, addVehicle, updateVehicle, deleteVehicle,
      trips, addTrip, recordTripCollection, deleteTrip,
      vehicleExpenses, addVehicleExpense, deleteVehicleExpense,
    }}>
      {children}
    </TransportOpsContext.Provider>
  );
}

export function useTransportOps(): TransportOpsContextValue {
  const ctx = useContext(TransportOpsContext);
  if (!ctx) throw new Error('useTransportOps must be used inside TransportOpsProvider');
  return ctx;
}
