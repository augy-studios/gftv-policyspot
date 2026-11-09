// api/policy/manage-document.js - Delete an uploaded document from storage and from the catalogue table (admin only)
const { getSupabaseClient } = require('../../lib/supabase');
const { validateSession }   = require('../../lib/auth');
const { sendSuccess, sendError, handleOptions } = require('../../lib/response');

module.exports = async (request, response) => {
    if (handleOptions(request, response)) {
        return;
    }
    if (request.method !== 'DELETE') {
        return sendError(response, 'Method not allowed', 405);
    }

    const user = await validateSession(request);
    if (!user) {
        return sendError(response, 'Unauthorized', 401);
    }
    if (!user.is_admin) {
        return sendError(response, 'Forbidden', 403);
    }

    const supabase = getSupabaseClient();
    // The id may be sent either in the URL query string or in the JSON body
    let documentId = null;
    if (request.query && request.query.id) {
        documentId = request.query.id;
    } else if (request.body && request.body.id) {
        documentId = request.body.id;
    }
    if (!documentId) {
        return sendError(response, 'Document id required');
    }

    const { data: documentRecord, error: fetchError } = await supabase
        .from('gftvpolicy_documents')
        .select('storage_path')
        .eq('id', documentId)
        .single();
    if (fetchError || !documentRecord) {
        return sendError(response, 'Document not found', 404);
    }

    await supabase.storage.from('policy-documents').remove([documentRecord.storage_path]);

    const { error: deleteError } = await supabase
        .from('gftvpolicy_documents')
        .delete()
        .eq('id', documentId);
    if (deleteError) {
        return sendError(response, 'Failed to delete document record');
    }
    return sendSuccess(response, { deleted: true });
};
