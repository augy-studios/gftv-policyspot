// api/policy/update-slug.js - Update slug for a section (admin/editor only)
const {
    getSupabaseClient
} = require('../../lib/supabase');
const {
    validateSession
} = require('../../lib/auth');
const {
    sendSuccess,
    sendError,
    handleOptions
} = require('../../lib/response');

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
    if (!user.is_admin && !user.is_editor) {
        return sendError(response, 'Forbidden', 403);
    }
    const {
        id: sectionId,
        slug
    } = request.body || {};
    if (!sectionId || !slug) {
        return sendError(response, 'id and slug required');
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
        return sendError(response, 'Slug must be lowercase alphanumeric with hyphens only');
    }
    const supabase = getSupabaseClient();
    // Check uniqueness
    const {
        data: sectionUsingSlug
    } = await supabase
        .from('gftvpolicy_charter')
        .select('id')
        .eq('slug', slug)
        .neq('id', sectionId)
        .single();
    if (sectionUsingSlug) {
        return sendError(response, 'Slug already in use', 409);
    }
    const {
        data: updatedSection,
        error
    } = await supabase
        .from('gftvpolicy_charter')
        .update({
            slug: slug,
            updated_at: new Date().toISOString()
        })
        .eq('id', sectionId)
        .select('id, slug, title')
        .single();
    if (error) {
        return sendError(response, 'Update failed');
    }
    return sendSuccess(response, {
        section: updatedSection
    });
};
