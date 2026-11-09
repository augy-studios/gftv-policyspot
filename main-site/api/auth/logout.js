// api/auth/logout.js - Signs the user out by deleting their session token.
const {
    getSupabaseClient
} = require('../../lib/supabase');
const {
    sendSuccess,
    sendError,
    handleOptions
} = require('../../lib/response');

const BEARER_PREFIX = 'Bearer ';

module.exports = async (request, response) => {
    if (handleOptions(request, response)) {
        return;
    }
    if (request.method !== 'POST') {
        return sendError(response, 'Method not allowed', 405);
    }
    const authorizationHeader = request.headers['authorization'];
    if (authorizationHeader && authorizationHeader.startsWith(BEARER_PREFIX)) {
        const sessionToken = authorizationHeader.slice(BEARER_PREFIX.length);
        const supabase = getSupabaseClient();
        await supabase.from('gftvhello_sessions').delete().eq('token', sessionToken);
    }
    return sendSuccess(response, {
        message: 'Logged out'
    });
};
