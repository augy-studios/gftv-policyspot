// lib/auth.js - Session validation helper
const {
    getSupabaseClient
} = require('./supabase');

// The "Authorization" header is expected to look like "Bearer <token>".
const BEARER_PREFIX = 'Bearer ';

/**
 * Looks up the session token sent in the request's "Authorization" header.
 * Returns the signed-in user's database row when the session is valid,
 * or null when the token is missing, unknown or expired.
 * Expired sessions are deleted from the database as a side effect.
 */
async function validateSession(request) {
    const authorizationHeader = request.headers['authorization'];
    if (!authorizationHeader || !authorizationHeader.startsWith(BEARER_PREFIX)) {
        return null;
    }
    const sessionToken = authorizationHeader.slice(BEARER_PREFIX.length);
    const supabase = getSupabaseClient();
    const {
        data: sessionRow,
        error
    } = await supabase
        .from('gftvhello_sessions')
        .select('user_id, expires_at, gftvhello_users(*)')
        .eq('token', sessionToken)
        .single();
    if (error || !sessionRow) {
        return null;
    }
    const sessionHasExpired = new Date(sessionRow.expires_at) < new Date();
    if (sessionHasExpired) {
        await supabase.from('gftvhello_sessions').delete().eq('token', sessionToken);
        return null;
    }
    return sessionRow.gftvhello_users;
}

module.exports = {
    validateSession
};
