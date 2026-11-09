// api/policy/add-section.js - Create a new section or subsection (admin only)
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
    if (request.method !== 'POST') {
        return sendError(response, 'Method not allowed', 405);
    }
    const user = await validateSession(request);
    if (!user) {
        return sendError(response, 'Unauthorized', 401);
    }
    if (!user.is_admin) {
        return sendError(response, 'Forbidden', 403);
    }

    const {
        table,
        title,
        slug,
        content,
        type,
        parent_id: parentId,
        number,
        anchor
    } = request.body || {};
    if (!table || !title || !slug || !type) {
        return sendError(response, 'table, title, slug, and type are required');
    }

    const tableName = TABLE_MAP[table];
    if (!tableName) {
        return sendError(response, 'Invalid table');
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
        return sendError(response, 'Slug must be lowercase alphanumeric with hyphens only');
    }

    const supabase = getSupabaseClient();

    const { data: existingSection } = await supabase
        .from(tableName)
        .select('id')
        .eq('slug', slug.trim())
        .maybeSingle();
    if (existingSection) {
        return sendError(response, 'Slug already in use', 409);
    }

    // Get the highest order_index among siblings to append at the end
    let siblingsResult;
    if (type === 'subsection' && parentId) {
        siblingsResult = await supabase
            .from(tableName)
            .select('order_index')
            .eq('parent_id', parentId)
            .eq('type', 'subsection')
            .order('order_index', { ascending: false })
            .limit(1);
    } else {
        siblingsResult = await supabase
            .from(tableName)
            .select('order_index')
            .is('parent_id', null)
            .neq('type', 'subsection')
            .order('order_index', { ascending: false })
            .limit(1);
    }
    let nextOrderIndex = 0;
    if (siblingsResult.data && siblingsResult.data.length > 0) {
        nextOrderIndex = siblingsResult.data[0].order_index + 1;
    }

    const { data: createdSection, error } = await supabase
        .from(tableName)
        .insert({
            slug: slug.trim(),
            title: title.trim(),
            content: content || '',
            type: type,
            parent_id: parentId || null,
            number: number || null,
            anchor: anchor || null,
            order_index: nextOrderIndex,
            is_published: true,
            updated_at: new Date().toISOString(),
        })
        .select('*')
        .single();

    if (error) {
        return sendError(response, 'Failed to create section: ' + error.message);
    }
    return sendSuccess(response, { section: createdSection });
};
