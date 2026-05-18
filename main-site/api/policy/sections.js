// api/policy/sections.js - List all policy sections
const {
    getSupabaseClient
} = require('../../lib/supabase');
const {
    ok,
    err,
    handleOptions
} = require('../../lib/response');

module.exports = async (req, res) => {
    if (handleOptions(req, res)) return;
    if (req.method !== 'GET') return err(res, 'Method not allowed', 405);
    const supabase = getSupabaseClient();
    const {
        data,
        error
    } = await supabase
        .from('gftvpolicy_charter')
        .select('id, slug, anchor, number, title, type, parent_id, order_index, is_published, content, updated_at')
        .eq('is_published', true)
        .order('order_index');
    if (error) return err(res, 'Failed to load sections');
    return ok(res, {
        sections: data
    });
};