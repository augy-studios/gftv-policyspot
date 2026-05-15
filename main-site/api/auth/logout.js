// api/auth/logout.js
const {
    getSupabaseClient
} = require('../../lib/supabase');
const {
    ok,
    err,
    handleOptions
} = require('../../lib/response');

module.exports = async (req, res) => {
    if (handleOptions(req, res)) return;
    if (req.method !== 'POST') return err(res, 'Method not allowed', 405);
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        const supabase = getSupabaseClient();
        await supabase.from('gftvhello_sessions').delete().eq('token', token);
    }
    return ok(res, {
        message: 'Logged out'
    });
};