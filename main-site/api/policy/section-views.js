// api/policy/section-views.js
// Returns view counts per section_id for a given doc
const { getSupabaseClient } = require('../../lib/supabase');
const { sendSuccess, sendError, handleOptions } = require('../../lib/response');

const VALID_DOCUMENTS = new Set(['charter', 'news', 'prs', 'rules', 'join', 'legal']);

module.exports = async (request, response) => {
    if (handleOptions(request, response)) {
        return;
    }
    if (request.method !== 'GET') {
        return sendError(response, 'Method not allowed', 405);
    }

    const { doc: documentName } = request.query || {};
    if (!documentName || !VALID_DOCUMENTS.has(documentName)) {
        return sendError(response, 'Invalid or missing doc');
    }

    const supabase = getSupabaseClient();
    const { data: visitRows, error } = await supabase
        .from('gftvpolicy_pagevisits')
        .select('section_id')
        .eq('doc', documentName);

    if (error) {
        return sendError(response, 'Failed to load views');
    }

    // Count how many visit rows there are for each section id
    const viewCounts = {};
    for (const visitRow of visitRows) {
        const previousCount = viewCounts[visitRow.section_id] || 0;
        viewCounts[visitRow.section_id] = previousCount + 1;
    }

    return sendSuccess(response, { views: viewCounts });
};
