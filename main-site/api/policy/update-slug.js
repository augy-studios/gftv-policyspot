// api/policy/update-slug.js - Update slug for a section (admin/editor only)
const {
    getSupabaseClient
} = require('../../lib/supabase');
const {
    validateSession
} = require('../../lib/auth');
const {
    ok,
    err,
    handleOptions
} = require('../../lib/response');

module.exports = async (req, res) => {
    if (handleOptions(req, res)) return;
    if (req.method !== 'PUT') return err(res, 'Method not allowed', 405);
    const user = await validateSession(req);
    if (!user) return err(res, 'Unauthorized', 401);
    if (!user.is_admin && !user.is_editor) return err(res, 'Forbidden', 403);
    const {
        id,
        slug
    } = req.body || {};
    if (!id || !slug) return err(res, 'id and slug required');
    if (!/^[a-z0-9-]+$/.test(slug)) return err(res, 'Slug must be lowercase alphanumeric with hyphens only');
    const supabase = getSupabaseClient();
    // Check uniqueness
    const {
        data: existing
    } = await supabase
        .from('gftvpolicy_sections')
        .select('id')
        .eq('slug', slug)
        .neq('id', id)
        .single();
    if (existing) return err(res, 'Slug already in use', 409);
    const {
        data,
        error
    } = await supabase
        .from('gftvpolicy_sections')
        .update({
            slug,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select('id, slug, title')
        .single();
    if (error) return err(res, 'Update failed');
    return ok(res, {
        section: data
    });
};