import { Response } from 'express';
import { flightService } from '../services/flightService';

interface AirportRealtimeClient {
  res: Response;
  iata: string;
}

export class AirportRealtimeServer {
  private clients = new Set<AirportRealtimeClient>();
  private intervalId: NodeJS.Timeout | null = null;

  /**
   * Registers a client SSE connection for a specific airport
   */
  addClient(res: Response, iata: string): AirportRealtimeClient {
    // Write headers for SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    const cleanIata = iata.trim().toUpperCase();

    // Write initial state
    const initialDisruption = flightService.generateAirportDisruption(cleanIata);
    res.write(`data: ${JSON.stringify(initialDisruption)}\n\n`);

    const client: AirportRealtimeClient = { res, iata: cleanIata };
    this.clients.add(client);
    
    console.log(`📡 Airport SSE Client connected for ${cleanIata}. Active clients: ${this.clients.size}`);
    
    // Start interval if it's the first client and not already running
    this.startBroadcastLoop();

    return client;
  }

  /**
   * Unregisters a client SSE connection
   */
  removeClient(client: AirportRealtimeClient): void {
    this.clients.delete(client);
    console.log(`📡 Airport SSE Client disconnected for ${client.iata}. Active clients: ${this.clients.size}`);
    
    // Stop the broadcast loop if no more clients are registered
    if (this.clients.size === 0) {
      this.stopBroadcastLoop();
    }
  }

  /**
   * Broadcasts the simulation updates to active clients
   */
  private broadcastUpdates(): void {
    if (this.clients.size === 0) return;

    // Find all unique iata codes currently being watched
    const uniqueIatas = new Set<string>();
    this.clients.forEach(client => uniqueIatas.add(client.iata));

    // Generate and send updates for each active iata
    uniqueIatas.forEach(iata => {
      try {
        const update = flightService.generateAirportDisruption(iata);
        const payload = JSON.stringify(update);

        this.clients.forEach(client => {
          if (client.iata === iata) {
            client.res.write(`data: ${payload}\n\n`);
          }
        });
      } catch (err: any) {
        console.error(`⚠️ Failed to broadcast disruption for airport ${iata}:`, err.message);
      }
    });
  }

  /**
   * Start the unified broadcast loop (every 15 seconds)
   */
  private startBroadcastLoop(): void {
    if (this.intervalId) return;

    this.intervalId = setInterval(() => {
      // Periodic ping to all clients to prevent timeout
      this.clients.forEach(client => {
        try {
          client.res.write(': ping\n\n'); // SSE comment ping
        } catch (err) {
          // Client might have been closed without trigger
        }
      });

      // Broadcast disruptions
      this.broadcastUpdates();
    }, 15000); // 15 seconds update
  }

  /**
   * Stop the unified broadcast loop
   */
  private stopBroadcastLoop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

export const airportRealtimeServer = new AirportRealtimeServer();
