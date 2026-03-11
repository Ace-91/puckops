import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { target = 'all' } = body; // 'games' | 'slots' | 'all'

    let deletedGames = 0;
    let deletedSlots = 0;

    if (target === 'games' || target === 'all') {
      const games = await base44.asServiceRole.entities.Game.list('date', 99999);
      const CHUNK = 10;
      for (let i = 0; i < games.length; i += CHUNK) {
        await Promise.all(games.slice(i, i + CHUNK).map(g => base44.asServiceRole.entities.Game.delete(g.id)));
        deletedGames += Math.min(CHUNK, games.length - i);
        if (i + CHUNK < games.length) await sleep(800);
      }
    }

    if (target === 'slots' || target === 'all') {
      const slots = await base44.asServiceRole.entities.IceSlot.list('date', 99999);
      const CHUNK = 10;
      for (let i = 0; i < slots.length; i += CHUNK) {
        await Promise.all(slots.slice(i, i + CHUNK).map(s => base44.asServiceRole.entities.IceSlot.delete(s.id)));
        deletedSlots += Math.min(CHUNK, slots.length - i);
        if (i + CHUNK < slots.length) await sleep(800);
      }
    }

    return Response.json({ success: true, deletedGames, deletedSlots });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});