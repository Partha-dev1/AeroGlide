import { Response } from 'express';

interface RealtimeClient {
  res: Response;
  flightId: string | null;
}

export class SeatRealtimeServer {
  private clients = new Set<RealtimeClient>();

  /**
   * Registers a client SSE connection
   */
  addClient(res: Response, flightId: string | null): RealtimeClient {
    // Write headers for SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    // Send a connection validation ping
    res.write('event: connected\ndata: {"status": "ok"}\n\n');

    const client: RealtimeClient = { res, flightId };
    this.clients.add(client);
    
    console.log(`📡 Realtime SSE Client connected. Active clients: ${this.clients.size}`);
    return client;
  }

  /**
   * Unregisters a client SSE connection
   */
  removeClient(client: RealtimeClient): void {
    this.clients.delete(client);
    console.log(`📡 Realtime SSE Client disconnected. Active clients: ${this.clients.size}`);
  }

  /**
   * Broadcasts a seat map update to all clients watching a specific flight
   */
  broadcastSeatsUpdate(flightId: string, seats: any[]): void {
    console.log(`📢 Broadcasting seat map update for Flight ${flightId} to watching clients...`);
    const payload = JSON.stringify({ flightId, seats });

    this.clients.forEach((client) => {
      if (client.flightId === flightId) {
        client.res.write(`event: seats\ndata: ${payload}\n\n`);
      }
    });
  }

  /**
   * Keep-alive ping loop to prevent gateway timeouts
   */
  startKeepAlive(): void {
    setInterval(() => {
      this.clients.forEach((client) => {
        client.res.write('event: ping\ndata: "keep-alive"\n\n');
      });
    }, 15000); // 15 seconds ping
  }
}
export const seatRealtimeServer = new SeatRealtimeServer();
seatRealtimeServer.startKeepAlive();
