// api/policy/news/section.js - Get a News Standards section by slug
const { getSupabaseClient } = require('../../../lib/supabase');
const { sendSuccess, sendError, handleOptions } = require('../../../lib/response');

module.exports = async (request, response) => {
    if (handleOptions(request, response)) {
        return;
    }
    if (request.method !== 'GET') {
        return sendError(response, 'Method not allowed', 405);
    }
    const { slug } = request.query;
    if (!slug) {
        return sendError(response, 'Slug required');
    }
    const supabase = getSupabaseClient();
    const { data: section, error } = await supabase
        .from('gftvpolicy_news')
        .select('*')
        .eq('slug', slug)
        .eq('is_published', true)
        .single();
    if (error || !section) {
        return sendError(response, 'Section not found', 404);
    }
    return sendSuccess(response, { section: section });
};
