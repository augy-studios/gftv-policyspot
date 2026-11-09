// api/policy/sounds.js - List all uploaded policy sounds (admin only)
const { getSupabaseClient } = require('../../lib/supabase');
const { validateSession }   = require('../../lib/auth');
const { sendSuccess, sendError, handleOptions } = require('../../lib/response');

module.exports = async (request, response) => {
    if (handleOptions(request, response)) {
        return;
    }
    if (request.method !== 'GET') {
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
    const { data: sounds, error } = await supabase
        .from('gftvpolicy_sounds')
        .select('id, filename, public_url, mime_type, file_size, uploaded_at')
        .order('uploaded_at', { ascending: false });

    if (error) {
        return sendError(response, 'Failed to load sounds');
    }
    return sendSuccess(response, { sounds: sounds });
};
