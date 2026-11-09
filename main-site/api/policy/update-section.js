// api/policy/update-section.js - Update title/content/anchor/number/slug for a section (admin only)
// Only the fields that are included in the request body are changed.
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
    const { id: sectionId, table, title, content, anchor, number, slug } = request.body || {};
    if (!sectionId || !table) {
        return sendError(response, 'id and table required');
    }
    const tableName = TABLE_MAP[table];
    if (!tableName) {
        return sendError(response, 'Invalid table');
    }
    if (title !== undefined && !String(title).trim()) {
        return sendError(response, 'Title cannot be empty');
    }
    if (slug !== undefined && !String(slug).trim()) {
        return sendError(response, 'Slug cannot be empty');
    }
    if (slug !== undefined && !/^[a-z0-9-]+$/.test(String(slug).trim())) {
        return sendError(response, 'Slug must be lowercase alphanumeric with hyphens only');
    }

    const updates = { updated_at: new Date().toISOString() };
    if (title !== undefined) {
        updates.title = String(title).trim();
    }
    if (content !== undefined) {
        updates.content = content;
    }
    if (anchor !== undefined) {
        updates.anchor = anchor || null;
    }
    if (number !== undefined) {
        updates.number = number || null;
    }
    if (slug !== undefined) {
        updates.slug = String(slug).trim();
    }

    const supabase = getSupabaseClient();
    if (slug !== undefined) {
        const { data: sectionUsingSlug } = await supabase
            .from(tableName)
            .select('id')
            .eq('slug', String(slug).trim())
            .neq('id', sectionId)
            .maybeSingle();
        if (sectionUsingSlug) {
            return sendError(response, 'Slug already in use', 409);
        }
    }
    const { data: updatedSection, error } = await supabase
        .from(tableName)
        .update(updates)
        .eq('id', sectionId)
        .select('*')
        .single();
    if (error) {
        return sendError(response, 'Update failed');
    }
    return sendSuccess(response, { section: updatedSection });
};
