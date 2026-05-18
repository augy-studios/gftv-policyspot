// api/policy/track-visit.js
// Records one page visit for `section_id` and returns the combined visit total
// across all `all_ids` (the article + every subsection on the same page).
const { getSupabaseClient } = require('../../lib/supabase');
const { ok, err, handleOptions } = require('../../lib/response');

const VALID_DOCS    = new Set(['charter', 'news', 'prs', 'rules', 'join']);
const VALID_DEVICES = new Set(['Desktop', 'Tablet', 'Mobile', 'Others']);

module.exports = async (req, res) => {
    if (handleOptions(req, res)) return;
    if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

    const { section_id, doc, slug, device_type, all_ids } = req.body || {};
    if (!section_id || !doc || !slug) return err(res, 'section_id, doc, and slug are required');
    if (!VALID_DOCS.has(doc))         return err(res, 'Invalid doc');

    const device   = VALID_DEVICES.has(device_type) ? device_type : 'Others';
    const countIds = Array.isArray(all_ids) && all_ids.length ? all_ids : [section_id];

    const supabase = getSupabaseClient();

    const { error: insertError } = await supabase
        .from('gftvpolicy_pagevisits')
        .insert({ section_id, doc, slug, device_type: device });

    if (insertError) return err(res, 'Failed to record visit');

    const { count, error: countError } = await supabase
        .from('gftvpolicy_pagevisits')
        .select('id', { count: 'exact', head: true })
        .in('section_id', countIds);

    return ok(res, { total: countError ? null : count });
};
