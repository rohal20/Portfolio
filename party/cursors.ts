// PartyKit relay for the live cursors on rohal.dev.
// It stores nothing: every message a visitor sends is forwarded to everyone else in the room.
import type * as Party from 'partykit/server';

export default class Cursors implements Party.Server {
  constructor(readonly room: Party.Room) {}

  onMessage(message: string, sender: Party.Connection) {
    if (typeof message !== 'string' || message.length > 300) return; // ignore junk
    this.room.broadcast(message, [sender.id]);
  }

  onClose(conn: Party.Connection) {
    // tell the others this visitor left (the client also sends "leave" on pagehide)
    this.room.broadcast(JSON.stringify({ t: 'leave', id: conn.id }), [conn.id]);
  }
}
