// api/policy/images.js - List all uploaded policy images (admin only)
const { getSupabaseClient } = require('../../lib/supabase');
const { validateSession }   = require('../../lib/auth');
const { ok, err, handleOptions } = require('../../lib/response');

module.exports = async (req, res) => {
    if (handleOptions(req, res)) return;
    if (req.method !== 'GET') return err(res, 'Method not allowed', 405);
    const user = await validateSession(req);
    if (!user)          return err(res, 'Unauthorized', 401);
    if (!user.is_admin) return err(res, 'Forbidden', 403);

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
        .from('gftvpolicy_images')
        .select('id, filename, public_url, mime_type, file_size, width, height, uploaded_at, description')
        .order('uploaded_at', { ascending: false });

    if (error) return err(res, 'Failed to load images');
    return ok(res, { images: data });
};
