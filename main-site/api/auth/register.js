// api/auth/register.js - Creates a new account that waits for admin approval.
const {
    getSupabaseClient
} = require('../../lib/supabase');
const {
    sendSuccess,
    sendError,
    handleOptions
} = require('../../lib/response');
const bcrypt = require('bcryptjs');

const MINIMUM_PASSWORD_LENGTH = 8;
const BCRYPT_SALT_ROUNDS = 12;

module.exports = async (request, response) => {
    if (handleOptions(request, response)) {
        return;
    }
    if (request.method !== 'POST') {
        return sendError(response, 'Method not allowed', 405);
    }
    const {
        username,
        display_name: displayName,
        email,
        password
    } = request.body || {};
    if (!username || !displayName || !email || !password) {
        return sendError(response, 'All fields required');
    }
    if (password.length < MINIMUM_PASSWORD_LENGTH) {
        return sendError(response, 'Password must be at least 8 characters');
    }
    const supabase = getSupabaseClient();
    const {
        data: existingUser
    } = await supabase
        .from('gftvhello_users')
        .select('id')
        .or(`email.eq.${email.toLowerCase()},username.eq.${username.toLowerCase()}`)
        .single();
    if (existingUser) {
        return sendError(response, 'Email or username already in use', 409);
    }
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    const {
        data: newUser,
        error
    } = await supabase
        .from('gftvhello_users')
        .insert({
            username: username.toLowerCase(),
            display_name: displayName,
            email: email.toLowerCase(),
            password_hash: passwordHash,
            is_approved: false
        })
        .select('id, username, display_name, email, is_approved, created_at')
        .single();
    if (error) {
        return sendError(response, 'Registration failed');
    }
    return sendSuccess(response, {
        message: 'Registration successful. Awaiting admin approval.',
        user: newUser
    }, 201);
};
