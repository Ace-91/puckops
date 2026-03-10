import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

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
      const CHUNK = 50;
      for (let i = 0; i < games.length; i += CHUNK) {
        await Promise.all(games.slice(i, i + CHUNK).map(g => base44.asServiceRole.entities.Game.delete(g.id)));
      }
      deletedGames = games.length;
    }

    if (target === 'slots' || target === 'all') {
      const slots = await base44.asServiceRole.entities.IceSlot.list('date', 99999);
      const CHUNK = 50;
      for (let i = 0; i < slots.length; i += CHUNK) {
        await Promise.all(slots.slice(i, i + CHUNK).map(s => base44.asServiceRole.entities.IceSlot.delete(s.id)));
      }
      deletedSlots = slots.length;
    }

    return Response.json({ success: true, deletedGames, deletedSlots });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});