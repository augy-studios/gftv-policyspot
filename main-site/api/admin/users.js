// api/admin/users.js - Admin user management
const {
    getSupabaseClient
} = require('../../lib/supabase');
const {
    validateSession
} = require('../../lib/auth');
const {
    ok,
    err,
    handleOptions
} = require('../../lib/response');

module.exports = async (req, res) => {
    if (handleOptions(req, res)) return;
    const user = await validateSession(req);
    if (!user || !user.is_admin) return err(res, 'Forbidden', 403);
    const supabase = getSupabaseClient();

    if (req.method === 'GET') {
        const {
            data,
            error
        } = await supabase
            .from('gftvhello_users')
            .select('id, username, display_name, email, is_admin, is_approved, is_editor, avatar_url, created_at')
            .order('created_at');
        if (error) return err(res, 'Failed to load users');
        return ok(res, {
            users: data
        });
    }

    if (req.method === 'PUT') {
        const {
            id,
            is_approved,
            is_admin,
            is_editor
        } = req.body || {};
        if (!id) return err(res, 'User id required');
        const updates = {};
        if (typeof is_approved === 'boolean') updates.is_approved = is_approved;
        if (typeof is_admin === 'boolean') updates.is_admin = is_admin;
        if (typeof is_editor === 'boolean') updates.is_editor = is_editor;
        const {
            data,
            error
        } = await supabase
            .from('gftvhello_users')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select('id, username, display_name, email, is_admin, is_approved, is_editor')
            .single();
        if (error) return err(res, 'Update failed');
        return ok(res, {
            user: data
        });
    }

    return err(res, 'Method not allowed', 405);
};