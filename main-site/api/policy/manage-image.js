// api/policy/manage-image.js - Delete or update image metadata (admin only)
// Note: PATCH (description update) requires a `description TEXT` column in gftvpolicy_images.
const { getSupabaseClient } = require('../../lib/supabase');
const { validateSession }   = require('../../lib/auth');
const { ok, err, handleOptions } = require('../../lib/response');

module.exports = async (req, res) => {
    if (handleOptions(req, res)) return;
    const user = await validateSession(req);
    if (!user)          return err(res, 'Unauthorized', 401);
    if (!user.is_admin) return err(res, 'Forbidden', 403);

    const supabase = getSupabaseClient();
    const id = req.query?.id || req.body?.id;
    if (!id) return err(res, 'Image id required');

    if (req.method === 'DELETE') {
        const { data: img, error: fetchErr } = await supabase
            .from('gftvpolicy_images')
            .select('storage_path')
            .eq('id', id)
            .single();
        if (fetchErr || !img) return err(res, 'Image not found', 404);

        await supabase.storage.from('policy-images').remove([img.storage_path]);

        const { error: delErr } = await supabase
            .from('gftvpolicy_images')
            .delete()
            .eq('id', id);
        if (delErr) return err(res, 'Failed to delete image record');
        return ok(res, { deleted: true });
    }

    if (req.method === 'PATCH') {
        const { description } = req.body || {};
        const { error: updErr } = await supabase
            .from('gftvpolicy_images')
            .update({ description: description ?? null })
            .eq('id', id);
        if (updErr) return err(res, 'Failed to update description');
        return ok(res, { updated: true });
    }

    return err(res, 'Method not allowed', 405);
};
