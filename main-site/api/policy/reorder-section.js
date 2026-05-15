// api/policy/reorder-section.js - Swap a section's order_index with its neighbor (admin only)
const { getSupabaseClient } = require('../../lib/supabase');
const { validateSession } = require('../../lib/auth');
const { ok, err, handleOptions } = require('../../lib/response');

const TABLE_MAP = {
    charter: 'gftvpolicy_charter',
    news:    'gftvpolicy_news',
    prs:     'gftvpolicy_prs',
    rules:   'gftvpolicy_rules',
    join:    'gftvpolicy_join',
};

module.exports = async (req, res) => {
    if (handleOptions(req, res)) return;
    if (req.method !== 'PUT') return err(res, 'Method not allowed', 405);
    const user = await validateSession(req);
    if (!user) return err(res, 'Unauthorized', 401);
    if (!user.is_admin) return err(res, 'Forbidden', 403);

    const { table, id, direction } = req.body || {};
    if (!table || !id || !['up', 'down'].includes(direction)) {
        return err(res, 'table, id, and direction (up/down) are required');
    }

    const tableName = TABLE_MAP[table];
    if (!tableName) return err(res, 'Invalid table');

    const supabase = getSupabaseClient();

    const { data: section, error: fetchErr } = await supabase
        .from(tableName).select('*').eq('id', id).single();
    if (fetchErr || !section) return err(res, 'Section not found');

    // Find the nearest neighbor in the same scope
    let neighborRes;
    if (section.type === 'subsection' && section.parent_id) {
        if (direction === 'up') {
            neighborRes = await supabase
                .from(tableName).select('id, order_index')
                .eq('parent_id', section.parent_id).eq('type', 'subsection')
                .lt('order_index', section.order_index)
                .order('order_index', { ascending: false }).limit(1);
        } else {
            neighborRes = await supabase
                .from(tableName).select('id, order_index')
                .eq('parent_id', section.parent_id).eq('type', 'subsection')
                .gt('order_index', section.order_index)
                .order('order_index', { ascending: true }).limit(1);
        }
    } else {
        if (direction === 'up') {
            neighborRes = await supabase
                .from(tableName).select('id, order_index')
                .is('parent_id', null).neq('type', 'subsection')
                .lt('order_index', section.order_index)
                .order('order_index', { ascending: false }).limit(1);
        } else {
            neighborRes = await supabase
                .from(tableName).select('id, order_index')
                .is('parent_id', null).neq('type', 'subsection')
                .gt('order_index', section.order_index)
                .order('order_index', { ascending: true }).limit(1);
        }
    }

    if (!neighborRes.data || neighborRes.data.length === 0) return err(res, 'Already at boundary');
    const neighbor = neighborRes.data[0];

    await supabase.from(tableName).update({ order_index: neighbor.order_index }).eq('id', section.id);
    await supabase.from(tableName).update({ order_index: section.order_index }).eq('id', neighbor.id);

    return ok(res, { swapped: true });
};
