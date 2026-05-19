const { getSupabaseClient } = require('../../lib/supabase');
const { validateSession }   = require('../../lib/auth');
const { ok, err, handleOptions } = require('../../lib/response');

module.exports = async (req, res) => {
    if (handleOptions(req, res)) return;
    if (req.method !== 'DELETE') return err(res, 'Method not allowed', 405);

    const user = await validateSession(req);
    if (!user)          return err(res, 'Unauthorized', 401);
    if (!user.is_admin) return err(res, 'Forbidden', 403);

    const supabase = getSupabaseClient();
    const id = req.query?.id || req.body?.id;
    if (!id) return err(res, 'Document id required');

    const { data: doc, error: fetchErr } = await supabase
        .from('gftvpolicy_documents')
        .select('storage_path')
        .eq('id', id)
        .single();
    if (fetchErr || !doc) return err(res, 'Document not found', 404);

    await supabase.storage.from('policy-documents').remove([doc.storage_path]);

    const { error: delErr } = await supabase
        .from('gftvpolicy_documents')
        .delete()
        .eq('id', id);
    if (delErr) return err(res, 'Failed to delete document record');
    return ok(res, { deleted: true });
};
