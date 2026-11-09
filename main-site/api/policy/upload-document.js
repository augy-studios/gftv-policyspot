// api/policy/upload-document.js - Upload a document to Supabase Storage (admin only)
// Bucket: policy-documents (must be created in the Supabase dashboard as a public bucket)
// The browser sends the file as base64 text inside a JSON body.
const { getSupabaseClient } = require('../../lib/supabase');
const { validateSession }   = require('../../lib/auth');
const { sendSuccess, sendError, handleOptions } = require('../../lib/response');

// Raise Vercel's default 1 MB JSON body-parser limit so base64-encoded files fit
module.exports.config = {
    api: { bodyParser: { sizeLimit: '30mb' } },
};

const ALLOWED_MIME_TYPES = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const MAXIMUM_FILE_SIZE_IN_BYTES = 20 * 1024 * 1024;

module.exports = async (request, response) => {
    if (handleOptions(request, response)) {
        return;
    }
    if (request.method !== 'POST') {
        return sendError(response, 'Method not allowed', 405);
    }

    const user = await validateSession(request);
    if (!user) {
        return sendError(response, 'Unauthorized', 401);
    }
    if (!user.is_admin) {
        return sendError(response, 'Forbidden', 403);
    }

    const {
        filename,
        mime_type: mimeType,
        data: base64Data
    } = request.body || {};
    if (!filename || !mimeType || !base64Data) {
        return sendError(response, 'filename, mime_type, and data are required');
    }
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
        return sendError(response, 'Unsupported file type');
    }

    const fileBuffer = Buffer.from(base64Data, 'base64');
    if (fileBuffer.byteLength > MAXIMUM_FILE_SIZE_IN_BYTES) {
        return sendError(response, 'File too large (max 20 MB)');
    }

    // Build a safe, unique storage path such as "1700000000000-my_file.pdf"
    const fileExtension = filename.split('.').pop().toLowerCase();
    const safeBaseName = filename
        .replace(/\.[^.]+$/, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 60);
    const storagePath = `${Date.now()}-${safeBaseName}.${fileExtension}`;

    const supabase = getSupabaseClient();

    const { error: uploadError } = await supabase.storage
        .from('policy-documents')
        .upload(storagePath, fileBuffer, { contentType: mimeType, upsert: false });
    if (uploadError) {
        return sendError(response, 'Storage upload failed: ' + uploadError.message);
    }

    const { data: { publicUrl } } = supabase.storage
        .from('policy-documents')
        .getPublicUrl(storagePath);

    // Record the upload in the catalogue table
    const { data: catalogueRecord, error: databaseError } = await supabase
        .from('gftvpolicy_documents')
        .insert({
            filename: filename,
            storage_path: storagePath,
            public_url: publicUrl,
            mime_type: mimeType,
            file_size: fileBuffer.byteLength,
        })
        .select('id, filename, public_url, mime_type, file_size, uploaded_at')
        .single();

    if (databaseError) {
        // Storage succeeded; return the URL even if the database record fails
        return sendSuccess(response, { url: publicUrl, document: null });
    }
    return sendSuccess(response, { url: publicUrl, document: catalogueRecord });
};
