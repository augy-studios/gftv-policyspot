// api/policy/reorder-section.js - Swap a section's order_index with its neighbor (admin only)
const { getSupabaseClient } = require('../../lib/supabase');
const { validateSession } = require('../../lib/auth');
const { sendSuccess, sendError, handleOptions } = require('../../lib/response');

// Maps the short document name used by the website to its database table.
const TABLE_MAP = {
    charter: 'gftvpolicy_charter',
    news:    'gftvpolicy_news',
    prs:     'gftvpolicy_prs',
    rules:   'gftvpolicy_rules',
    join:    'gftvpolicy_join',
    legal:   'gftvpolicy_legal',
};

module.exports = async (request, response) => {
    if (handleOptions(request, response)) {
        return;
    }
    if (request.method !== 'PUT') {
        return sendError(response, 'Method not allowed', 405);
    }
    const user = await validateSession(request);
    if (!user) {
        return sendError(response, 'Unauthorized', 401);
    }
    if (!user.is_admin) {
        return sendError(response, 'Forbidden', 403);
    }

    const { table, id: sectionId, direction } = request.body || {};
    if (!table || !sectionId || !['up', 'down'].includes(direction)) {
        return sendError(response, 'table, id, and direction (up/down) are required');
    }

    const tableName = TABLE_MAP[table];
    if (!tableName) {
        return sendError(response, 'Invalid table');
    }

    const supabase = getSupabaseClient();

    const { data: section, error: fetchError } = await supabase
        .from(tableName).select('*').eq('id', sectionId).single();
    if (fetchError || !section) {
        return sendError(response, 'Section not found');
    }

    // Find the nearest neighbor in the same scope.
    // Subsections are only compared with other subsections of the same parent;
    // top-level sections are only compared with other top-level sections.
    let neighborQuery = supabase.from(tableName).select('id, order_index');
    if (section.type === 'subsection' && section.parent_id) {
        neighborQuery = neighborQuery.eq('parent_id', section.parent_id).eq('type', 'subsection');
    } else {
        neighborQuery = neighborQuery.is('parent_id', null).neq('type', 'subsection');
    }

    // "up" means the closest item with a smaller order_index,
    // "down" means the closest item with a larger order_index.
    if (direction === 'up') {
        neighborQuery = neighborQuery
            .lt('order_index', section.order_index)
            .order('order_index', { ascending: false });
    } else {
        neighborQuery = neighborQuery
            .gt('order_index', section.order_index)
            .order('order_index', { ascending: true });
    }
    const neighborResult = await neighborQuery.limit(1);

    if (!neighborResult.data || neighborResult.data.length === 0) {
        return sendError(response, 'Already at boundary');
    }
    const neighbor = neighborResult.data[0];

    await supabase.from(tableName).update({ order_index: neighbor.order_index }).eq('id', section.id);
    await supabase.from(tableName).update({ order_index: section.order_index }).eq('id', neighbor.id);

    return sendSuccess(response, { swapped: true });
};
