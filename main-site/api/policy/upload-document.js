const { getSupabaseClient } = require('../../lib/supabase');
const { validateSession }   = require('../../lib/auth');
const { ok, err, handleOptions } = require('../../lib/response');

module.exports.config = {
    api: { bodyParser: { sizeLimit: '30mb' } },
};

const ALLOWED_MIME = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const MAX_BYTES = 20 * 1024 * 1024;

module.exports = async (req, res) => {
    if (handleOptions(req, res)) return;
    if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

    const user = await validateSession(req);
    if (!user)          return err(res, 'Unauthorized', 401);
    if (!user.is_admin) return err(res, 'Forbidden', 403);

    const { filename, mime_type, data } = req.body || {};
    if (!filename || !mime_type || !data) return err(res, 'filename, mime_type, and data are required');
    if (!ALLOWED_MIME.has(mime_type))     return err(res, 'Unsupported file type');

    const buffer = Buffer.from(data, 'base64');
    if (buffer.byteLength > MAX_BYTES) return err(res, 'File too large (max 20 MB)');

    const ext         = filename.split('.').pop().toLowerCase();
    const safeName    = filename.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
    const storagePath = `${Date.now()}-${safeName}.${ext}`;

    const supabase = getSupabaseClient();

    const { error: uploadError } = await supabase.storage
        .from('policy-documents')
        .upload(storagePath, buffer, { contentType: mime_type, upsert: false });
    if (uploadError) return err(res, 'Storage upload failed: ' + uploadError.message);

    const { data: { publicUrl } } = supabase.storage
        .from('policy-documents')
        .getPublicUrl(storagePath);

    const { data: record, error: dbError } = await supabase
        .from('gftvpolicy_documents')
        .insert({ filename, storage_path: storagePath, public_url: publicUrl, mime_type, file_size: buffer.byteLength })
        .select('id, filename, public_url, mime_type, file_size, uploaded_at')
        .single();

    if (dbError) return ok(res, { url: publicUrl, document: null });
    return ok(res, { url: publicUrl, document: record });
};
