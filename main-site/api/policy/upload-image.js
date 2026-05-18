// api/policy/upload-image.js - Upload an image to Supabase Storage (admin only)
// Bucket: policy-images (must be created in Supabase dashboard as a public bucket)
const { getSupabaseClient } = require('../../lib/supabase');
const { validateSession }   = require('../../lib/auth');
const { ok, err, handleOptions } = require('../../lib/response');

// Raise Vercel's default 1 MB JSON body-parser limit so base64-encoded images fit
module.exports.config = {
    api: { bodyParser: { sizeLimit: '12mb' } },
};

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']);
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB after compression

module.exports = async (req, res) => {
    if (handleOptions(req, res)) return;
    if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

    const user = await validateSession(req);
    if (!user)          return err(res, 'Unauthorized', 401);
    if (!user.is_admin) return err(res, 'Forbidden', 403);

    const { filename, mime_type, data, width, height } = req.body || {};
    if (!filename || !mime_type || !data) return err(res, 'filename, mime_type, and data are required');
    if (!ALLOWED_MIME.has(mime_type))     return err(res, 'Unsupported file type');

    const buffer = Buffer.from(data, 'base64');
    if (buffer.byteLength > MAX_BYTES)    return err(res, 'File too large (max 8 MB)');

    const ext         = filename.split('.').pop().toLowerCase();
    const safeName    = filename.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
    const storagePath = `${Date.now()}-${safeName}.${ext}`;

    const supabase = getSupabaseClient();

    const { error: uploadError } = await supabase.storage
        .from('policy-images')
        .upload(storagePath, buffer, { contentType: mime_type, upsert: false });

    if (uploadError) return err(res, 'Storage upload failed: ' + uploadError.message);

    const { data: { publicUrl } } = supabase.storage
        .from('policy-images')
        .getPublicUrl(storagePath);

    // Record the upload in the catalogue table
    const { data: record, error: dbError } = await supabase
        .from('gftvpolicy_images')
        .insert({
            filename,
            storage_path: storagePath,
            public_url:   publicUrl,
            mime_type,
            file_size:    buffer.byteLength,
            width:        width  || null,
            height:       height || null,
        })
        .select('id, filename, public_url, mime_type, file_size, width, height, uploaded_at')
        .single();

    if (dbError) {
        // Storage succeeded; return the URL even if DB logging fails
        return ok(res, { url: publicUrl, image: null });
    }

    return ok(res, { url: publicUrl, image: record });
};
