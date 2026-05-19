// api/policy/update-section.js - Update title/content/anchor/number for a section (admin only)
const { getSupabaseClient } = require('../../lib/supabase');
const { validateSession } = require('../../lib/auth');
const { ok, err, handleOptions } = require('../../lib/response');

const TABLE_MAP = {
    charter: 'gftvpolicy_charter',
    news:    'gftvpolicy_news',
    prs:     'gftvpolicy_prs',
    rules:   'gftvpolicy_rules',
    join:    'gftvpolicy_join',
    terms:   'gftvpolicy_terms',
    privacy: 'gftvpolicy_privacy',
};

module.exports = async (req, res) => {
    if (handleOptions(req, res)) return;
    if (req.method !== 'PUT') return err(res, 'Method not allowed', 405);
    const user = await validateSession(req);
    if (!user) return err(res, 'Unauthorized', 401);
    if (!user.is_admin) return err(res, 'Forbidden', 403);
    const { id, table, title, content, anchor, number, slug } = req.body || {};
    if (!id || !table) return err(res, 'id and table required');
    const tableName = TABLE_MAP[table];
    if (!tableName) return err(res, 'Invalid table');
    if (title !== undefined && !String(title).trim()) return err(res, 'Title cannot be empty');
    if (slug !== undefined && !String(slug).trim()) return err(res, 'Slug cannot be empty');
    if (slug !== undefined && !/^[a-z0-9-]+$/.test(String(slug).trim())) return err(res, 'Slug must be lowercase alphanumeric with hyphens only');
    const updates = { updated_at: new Date().toISOString() };
    if (title   !== undefined) updates.title   = String(title).trim();
    if (content !== undefined) updates.content = content;
    if (anchor  !== undefined) updates.anchor  = anchor || null;
    if (number  !== undefined) updates.number  = number || null;
    if (slug    !== undefined) updates.slug    = String(slug).trim();
    const supabase = getSupabaseClient();
    if (slug !== undefined) {
        const { data: existing } = await supabase
            .from(tableName).select('id').eq('slug', String(slug).trim()).neq('id', id).maybeSingle();
        if (existing) return err(res, 'Slug already in use', 409);
    }
    const { data, error } = await supabase
        .from(tableName)
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();
    if (error) return err(res, 'Update failed');
    return ok(res, { section: data });
};
