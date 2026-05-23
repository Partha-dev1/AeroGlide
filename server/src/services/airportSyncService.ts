import { supabase, useSupabase } from '../config/serverConfig';

export class AirportSyncService {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  public start() {
    if (this.intervalId) return;

    console.log('🔄 Airport Sync Service started.');
    
    // Run once at startup after a brief delay to let seeding finish
    setTimeout(() => {
      this.syncTasks().catch(err => {
        console.error('Error during initial sync task execution:', err);
      });
    }, 10000);

    this.intervalId = setInterval(() => {
      this.syncTasks().catch(err => {
        console.error('Error during periodic sync task execution:', err);
      });
    }, this.SYNC_INTERVAL_MS);
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🔄 Airport Sync Service stopped.');
    }
  }

  private async syncTasks() {
    if (!useSupabase || !supabase) return;

    try {
      // 1. Clean up expired search caches
      const nowIso = new Date().toISOString();
      const { data, error: deleteErr } = await supabase
        .from('airport_search_cache')
        .delete()
        .lt('expires_at', nowIso)
        .select();

      if (deleteErr) {
        console.warn('⚠️ Sync: Failed to clean up expired airport search caches:', deleteErr.message);
      } else if (data && data.length > 0) {
        console.log(`🧹 Sync: Cleaned up ${data.length} expired search cache entries.`);
      }

      // 2. Sync popularity from DB back to local in-memory DB to match other instances/operations
      const { data: dbPopularity, error: popErr } = await supabase
        .from('airports')
        .select('iata, popularity');

      if (!popErr && dbPopularity) {
        let updateCount = 0;
        const { airportsDatabase } = await import('../repositories/airportsDatabase');
        for (const row of dbPopularity) {
          const localAirport = airportsDatabase.getByIata(row.iata);
          if (localAirport && localAirport.popularity !== row.popularity) {
            localAirport.popularity = row.popularity;
            updateCount++;
          }
        }
        if (updateCount > 0) {
          console.log(`📈 Sync: Updated popularity for ${updateCount} local airports from Supabase.`);
        }
      }
    } catch (err: any) {
      console.error('⚠️ Sync Service Exception:', err.message);
    }
  }
}

export const airportSyncService = new AirportSyncService();
