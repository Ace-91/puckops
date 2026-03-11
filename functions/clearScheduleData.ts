import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function deleteSequentially(items, deleteFn, delayMs = 300) {
  let count = 0;
  for (const item of items) {
    await deleteFn(item.id);
    count++;
    await sleep(delayMs);
  }
  return count;
}

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
      deletedGames = await deleteSequentially(games, (id) => base44.asServiceRole.entities.Game.delete(id), 250);
    }

    if (target === 'slots' || target === 'all') {
      const slots = await base44.asServiceRole.entities.IceSlot.list('date', 99999);
      deletedSlots = await deleteSequentially(slots, (id) => base44.asServiceRole.entities.IceSlot.delete(id), 250);
    }

    return Response.json({ success: true, deletedGames, deletedSlots });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});