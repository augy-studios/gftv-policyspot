// lib/auth.js - Session validation helper
const {
    getSupabaseClient
} = require('./supabase');

async function validateSession(req) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7);
    const supabase = getSupabaseClient();
    const {
        data,
        error
    } = await supabase
        .from('gftvhello_sessions')
        .select('user_id, expires_at, gftvhello_users(*)')
        .eq('token', token)
        .single();
    if (error || !data) return null;
    if (new Date(data.expires_at) < new Date()) {
        await supabase.from('gftvhello_sessions').delete().eq('token', token);
        return null;
    }
    return data.gftvhello_users;
}

module.exports = {
    validateSession
};