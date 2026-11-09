// api/policy/manage-sound.js - Delete an uploaded sound from storage and from the catalogue table (admin only)
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
    let soundId = null;
    if (request.query && request.query.id) {
        soundId = request.query.id;
    } else if (request.body && request.body.id) {
        soundId = request.body.id;
    }
    if (!soundId) {
        return sendError(response, 'Sound id required');
    }

    const { data: soundRecord, error: fetchError } = await supabase
        .from('gftvpolicy_sounds')
        .select('storage_path')
        .eq('id', soundId)
        .single();
    if (fetchError || !soundRecord) {
        return sendError(response, 'Sound not found', 404);
    }

    await supabase.storage.from('policy-sounds').remove([soundRecord.storage_path]);

    const { error: deleteError } = await supabase
        .from('gftvpolicy_sounds')
        .delete()
        .eq('id', soundId);
    if (deleteError) {
        return sendError(response, 'Failed to delete sound record');
    }
    return sendSuccess(response, { deleted: true });
};
