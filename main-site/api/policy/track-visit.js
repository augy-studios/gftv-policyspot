// api/policy/track-visit.js
// Records one page visit for `section_id` and returns the combined visit total
// across all `all_ids` (the article + every subsection on the same page).
const { getSupabaseClient } = require('../../lib/supabase');
const { sendSuccess, sendError, handleOptions } = require('../../lib/response');

const VALID_DOCUMENTS    = new Set(['charter', 'news', 'prs', 'rules', 'join', 'legal']);
const VALID_DEVICE_TYPES = new Set(['Desktop', 'Tablet', 'Mobile', 'Others']);

module.exports = async (request, response) => {
    if (handleOptions(request, response)) {
        return;
    }
    if (request.method !== 'POST') {
        return sendError(response, 'Method not allowed', 405);
    }

    const {
        section_id: sectionId,
        doc: documentName,
        slug,
        device_type: deviceTypeFromBrowser,
        all_ids: allSectionIds
    } = request.body || {};
    if (!sectionId || !documentName || !slug) {
        return sendError(response, 'section_id, doc, and slug are required');
    }
    if (!VALID_DOCUMENTS.has(documentName)) {
        return sendError(response, 'Invalid doc');
    }

    // Anything we do not recognise is stored as "Others"
    let deviceType = 'Others';
    if (VALID_DEVICE_TYPES.has(deviceTypeFromBrowser)) {
        deviceType = deviceTypeFromBrowser;
    }

    // Count visits across every id on the page, or just this section if none were sent
    let idsToCount = [sectionId];
    if (Array.isArray(allSectionIds) && allSectionIds.length > 0) {
        idsToCount = allSectionIds;
    }

    const supabase = getSupabaseClient();

    const { error: insertError } = await supabase
        .from('gftvpolicy_pagevisits')
        .insert({ section_id: sectionId, doc: documentName, slug: slug, device_type: deviceType });

    if (insertError) {
        return sendError(response, 'Failed to record visit');
    }

    const { count: visitCount, error: countError } = await supabase
        .from('gftvpolicy_pagevisits')
        .select('id', { count: 'exact', head: true })
        .in('section_id', idsToCount);

    let totalVisits = visitCount;
    if (countError) {
        totalVisits = null;
    }
    return sendSuccess(response, { total: totalVisits });
};
