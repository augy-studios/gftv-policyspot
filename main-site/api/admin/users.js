// api/admin/users.js - Admin user management
// GET lists every user. PUT changes a user's approved / admin / editor flags.
const {
    getSupabaseClient
} = require('../../lib/supabase');
const {
    validateSession
} = require('../../lib/auth');
const {
    sendSuccess,
    sendError,
    handleOptions
} = require('../../lib/response');

module.exports = async (request, response) => {
    if (handleOptions(request, response)) {
        return;
    }
    const currentUser = await validateSession(request);
    if (!currentUser || !currentUser.is_admin) {
        return sendError(response, 'Forbidden', 403);
    }
    const supabase = getSupabaseClient();

    if (request.method === 'GET') {
        const {
            data: users,
            error
        } = await supabase
            .from('gftvhello_users')
            .select('id, username, display_name, email, is_admin, is_approved, is_editor, avatar_url, created_at')
            .order('created_at');
        if (error) {
            return sendError(response, 'Failed to load users');
        }
        return sendSuccess(response, {
            users: users
        });
    }

    if (request.method === 'PUT') {
        const {
            id: userId,
            is_approved: isApproved,
            is_admin: isAdmin,
            is_editor: isEditor
        } = request.body || {};
        if (!userId) {
            return sendError(response, 'User id required');
        }
        // Only include the flags that were actually sent as true/false
        const updates = {};
        if (typeof isApproved === 'boolean') {
            updates.is_approved = isApproved;
        }
        if (typeof isAdmin === 'boolean') {
            updates.is_admin = isAdmin;
        }
        if (typeof isEditor === 'boolean') {
            updates.is_editor = isEditor;
        }
        const {
            data: updatedUser,
            error
        } = await supabase
            .from('gftvhello_users')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId)
            .select('id, username, display_name, email, is_admin, is_approved, is_editor')
            .single();
        if (error) {
            return sendError(response, 'Update failed');
        }
        return sendSuccess(response, {
            user: updatedUser
        });
    }

    return sendError(response, 'Method not allowed', 405);
};
