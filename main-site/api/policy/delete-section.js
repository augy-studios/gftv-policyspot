// api/policy/delete-section.js - Delete a section and its subsections (admin only)
const { getSupabaseClient } = require('../../lib/supabase');
const { validateSession } = require('../../lib/auth');
const { ok, err, handleOptions } = require('../../lib/response');

const TABLE_MAP = {
    charter: 'gftvpolicy_charter',
    news:    'gftvpolicy_news',
    prs:     'gftvpolicy_prs',
    rules:   'gftvpolicy_rules',
    join:    'gftvpolicy_join',
    legal:   'gftvpolicy_legal',
};

module.exports = async (req, res) => {
    if (handleOptions(req, res)) return;
    if (req.method !== 'DELETE') return err(res, 'Method not allowed', 405);
    const user = await validateSession(req);
    if (!user) return err(res, 'Unauthorized', 401);
    if (!user.is_admin) return err(res, 'Forbidden', 403);

    const { table, id } = req.body || {};
    if (!table || !id) return err(res, 'table and id are required');

    const tableName = TABLE_MAP[table];
    if (!tableName) return err(res, 'Invalid table');

    const supabase = getSupabaseClient();

    // Delete any subsections belonging to this section first
    await supabase.from(tableName).delete().eq('parent_id', id);

    const { error } = await supabase.from(tableName).delete().eq('id', id);
    if (error) return err(res, 'Delete failed: ' + error.message);

    return ok(res, { deleted: true });
};
