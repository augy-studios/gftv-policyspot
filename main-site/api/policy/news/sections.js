// api/policy/news/sections.js - List all News Standards sections
const { getSupabaseClient } = require('../../../lib/supabase');
const { sendSuccess, sendError, handleOptions } = require('../../../lib/response');

module.exports = async (request, response) => {
    if (handleOptions(request, response)) {
        return;
    }
    if (request.method !== 'GET') {
        return sendError(response, 'Method not allowed', 405);
    }
    const supabase = getSupabaseClient();
    const { data: sections, error } = await supabase
        .from('gftvpolicy_news')
        .select('id, slug, anchor, number, title, type, parent_id, order_index, is_published, content, updated_at')
        .eq('is_published', true)
        .order('order_index');
    if (error) {
        return sendError(response, 'Failed to load sections');
    }
    return sendSuccess(response, { sections: sections });
};
