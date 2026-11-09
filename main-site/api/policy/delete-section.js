// api/policy/delete-section.js - Delete a section and its subsections (admin only)
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
    if (request.method !== 'DELETE') {
        return sendError(response, 'Method not allowed', 405);
    }
    const user = await validateSession(request);
    if (!user) {
        return sendError(response, 'Unauthorized', 401);
    }
    if (!user.is_admin) {
        return sendError(response, 'Forbidden', 403);
    }

    const { table, id: sectionId } = request.body || {};
    if (!table || !sectionId) {
        return sendError(response, 'table and id are required');
    }

    const tableName = TABLE_MAP[table];
    if (!tableName) {
        return sendError(response, 'Invalid table');
    }

    const supabase = getSupabaseClient();

    // Delete any subsections belonging to this section first
    await supabase.from(tableName).delete().eq('parent_id', sectionId);

    const { error } = await supabase.from(tableName).delete().eq('id', sectionId);
    if (error) {
        return sendError(response, 'Delete failed: ' + error.message);
    }

    return sendSuccess(response, { deleted: true });
};
