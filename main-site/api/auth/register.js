// api/auth/register.js
const {
    getSupabaseClient
} = require('../../lib/supabase');
const {
    ok,
    err,
    handleOptions
} = require('../../lib/response');
const bcrypt = require('bcryptjs');

module.exports = async (req, res) => {
    if (handleOptions(req, res)) return;
    if (req.method !== 'POST') return err(res, 'Method not allowed', 405);
    const {
        username,
        display_name,
        email,
        password
    } = req.body || {};
    if (!username || !display_name || !email || !password)
        return err(res, 'All fields required');
    if (password.length < 8) return err(res, 'Password must be at least 8 characters');
    const supabase = getSupabaseClient();
    const {
        data: existing
    } = await supabase
        .from('gftvhello_users')
        .select('id')
        .or(`email.eq.${email.toLowerCase()},username.eq.${username.toLowerCase()}`)
        .single();
    if (existing) return err(res, 'Email or username already in use', 409);
    const password_hash = await bcrypt.hash(password, 12);
    const {
        data: user,
        error
    } = await supabase
        .from('gftvhello_users')
        .insert({
            username: username.toLowerCase(),
            display_name,
            email: email.toLowerCase(),
            password_hash,
            is_approved: false
        })
        .select('id, username, display_name, email, is_approved, created_at')
        .single();
    if (error) return err(res, 'Registration failed');
    return ok(res, {
        message: 'Registration successful. Awaiting admin approval.',
        user
    }, 201);
};