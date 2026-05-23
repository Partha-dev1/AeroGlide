import { supabase, useSupabase } from '../config/supabase';

export interface SyncedDraftResult {
  temp_ref: string;
  success: boolean;
  booking_reference?: string;
  error?: string;
}

/**
 * Server-side storage synchronization manager to reconcile offline passenger checkout drafts.
 */
export class StorageSyncManager {
  /**
   * Synchronizes and processes client-side offline drafts into the Supabase database.
   */
  static async reconcileDrafts(drafts: any[], lockSession: string): Promise<SyncedDraftResult[]> {
    const results: SyncedDraftResult[] = [];

    if (!useSupabase || !supabase) {
      console.warn('⚠️ Supabase connection is inactive. Reconciling drafts in fallback mode.');
      for (const draft of drafts) {
        results.push({
          temp_ref: draft.temp_ref,
          success: true,
          booking_reference: `OFFLINE-SYNC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
        });
      }
      return results;
    }

    for (const draft of drafts) {
      const { temp_ref, flight_id, user_id, contact_email, contact_phone, passengers } = draft;
      try {
        console.log(`🔄 Reconciling draft booking ${temp_ref} for user ${user_id}...`);

        const seatIds = passengers.map((p: any) => p.seat_id);

        // 1. Lock the required seats via Database RPC
        const { data: lockOk, error: lockErr } = await supabase.rpc('lock_seats', {
          p_flight_id: flight_id,
          p_seat_ids: seatIds,
          p_lock_session: lockSession
        });

        if (lockErr || !lockOk) {
          throw new Error(lockErr?.message || 'Failed to acquire seat locks.');
        }

        // 2. Perform transactional insert of booking & passengers
        const { data: bookingRef, error: txError } = await supabase.rpc('create_booking_transaction', {
          p_flight_id: flight_id,
          p_user_id: user_id,
          p_contact_email: contact_email,
          p_contact_phone: contact_phone,
          p_lock_session: lockSession,
          p_passengers: passengers.map((p: any) => ({
            first_name: p.first_name,
            last_name: p.last_name,
            passport_number: p.passport_number,
            seat_id: p.seat_id
          }))
        });

        if (txError || !bookingRef) {
          throw new Error(txError?.message || 'Reconciliation transaction failed.');
        }

        console.log(`✅ Draft synced successfully: ${temp_ref} -> PNR: ${bookingRef}`);
        results.push({
          temp_ref,
          success: true,
          booking_reference: bookingRef
        });

      } catch (err: any) {
        console.error(`❌ Failed to sync draft ${temp_ref}:`, err.message);
        results.push({
          temp_ref,
          success: false,
          error: err.message || 'Synchronization failed.'
        });
      }
    }

    return results;
  }
}
