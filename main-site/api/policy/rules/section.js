// api/policy/rules/section.js - Get a Community Rules section by slug
const { getSupabaseClient } = require('../../../lib/supabase');
const { ok, err, handleOptions } = require('../../../lib/response');

module.exports = async (req, res) => {
    if (handleOptions(req, res)) return;
    if (req.method !== 'GET') return err(res, 'Method not allowed', 405);
    const { slug } = req.query;
    if (!slug) return err(res, 'Slug required');
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
        .from('gftvpolicy_rules')
        .select('*')
        .eq('slug', slug)
        .eq('is_published', true)
        .single();
    if (error || !data) return err(res, 'Section not found', 404);
    return ok(res, { section: data });
};
