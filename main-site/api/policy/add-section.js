// api/policy/add-section.js - Create a new section or subsection (admin only)
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
    if (req.method !== 'POST') return err(res, 'Method not allowed', 405);
    const user = await validateSession(req);
    if (!user) return err(res, 'Unauthorized', 401);
    if (!user.is_admin) return err(res, 'Forbidden', 403);

    const { table, title, slug, content, type, parent_id, number, anchor } = req.body || {};
    if (!table || !title || !slug || !type) return err(res, 'table, title, slug, and type are required');

    const tableName = TABLE_MAP[table];
    if (!tableName) return err(res, 'Invalid table');
    if (!/^[a-z0-9-]+$/.test(slug)) return err(res, 'Slug must be lowercase alphanumeric with hyphens only');

    const supabase = getSupabaseClient();

    const { data: existing } = await supabase
        .from(tableName)
        .select('id')
        .eq('slug', slug.trim())
        .maybeSingle();
    if (existing) return err(res, 'Slug already in use', 409);

    // Get the highest order_index among siblings to append at the end
    let siblingsRes;
    if (type === 'subsection' && parent_id) {
        siblingsRes = await supabase
            .from(tableName)
            .select('order_index')
            .eq('parent_id', parent_id)
            .eq('type', 'subsection')
            .order('order_index', { ascending: false })
            .limit(1);
    } else {
        siblingsRes = await supabase
            .from(tableName)
            .select('order_index')
            .is('parent_id', null)
            .neq('type', 'subsection')
            .order('order_index', { ascending: false })
            .limit(1);
    }
    const nextOrder = siblingsRes.data && siblingsRes.data.length > 0
        ? siblingsRes.data[0].order_index + 1
        : 0;

    const { data, error } = await supabase
        .from(tableName)
        .insert({
            slug: slug.trim(),
            title: title.trim(),
            content: content || '',
            type,
            parent_id: parent_id || null,
            number: number || null,
            anchor: anchor || null,
            order_index: nextOrder,
            is_published: true,
            updated_at: new Date().toISOString(),
        })
        .select('*')
        .single();

    if (error) return err(res, 'Failed to create section: ' + error.message);
    return ok(res, { section: data });
};
