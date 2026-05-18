// api/policy/section-views.js
// Returns view counts per section_id for a given doc
const { getSupabaseClient } = require('../../lib/supabase');
const { ok, err, handleOptions } = require('../../lib/response');

const VALID_DOCS = new Set(['charter', 'news', 'prs', 'rules', 'join']);

module.exports = async (req, res) => {
    if (handleOptions(req, res)) return;
    if (req.method !== 'GET') return err(res, 'Method not allowed', 405);

    const { doc } = req.query || {};
    if (!doc || !VALID_DOCS.has(doc)) return err(res, 'Invalid or missing doc');

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
        .from('gftvpolicy_pagevisits')
        .select('section_id')
        .eq('doc', doc);

    if (error) return err(res, 'Failed to load views');

    const counts = {};
    for (const row of data) {
        counts[row.section_id] = (counts[row.section_id] || 0) + 1;
    }

    return ok(res, { views: counts });
};
