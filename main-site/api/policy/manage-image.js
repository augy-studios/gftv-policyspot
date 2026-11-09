// api/policy/manage-image.js - Delete or update image metadata (admin only)
// Note: PATCH (description update) requires a `description TEXT` column in gftvpolicy_images.
const { getSupabaseClient } = require('../../lib/supabase');
const { validateSession }   = require('../../lib/auth');
const { sendSuccess, sendError, handleOptions } = require('../../lib/response');

module.exports = async (request, response) => {
    if (handleOptions(request, response)) {
        return;
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
    let imageId = null;
    if (request.query && request.query.id) {
        imageId = request.query.id;
    } else if (request.body && request.body.id) {
        imageId = request.body.id;
    }
    if (!imageId) {
        return sendError(response, 'Image id required');
    }

    if (request.method === 'DELETE') {
        const { data: imageRecord, error: fetchError } = await supabase
            .from('gftvpolicy_images')
            .select('storage_path')
            .eq('id', imageId)
            .single();
        if (fetchError || !imageRecord) {
            return sendError(response, 'Image not found', 404);
        }

        await supabase.storage.from('policy-images').remove([imageRecord.storage_path]);

        const { error: deleteError } = await supabase
            .from('gftvpolicy_images')
            .delete()
            .eq('id', imageId);
        if (deleteError) {
            return sendError(response, 'Failed to delete image record');
        }
        return sendSuccess(response, { deleted: true });
    }

    if (request.method === 'PATCH') {
        const { description } = request.body || {};
        // A missing description (null or undefined) clears the stored value
        let newDescription = description;
        if (description === undefined || description === null) {
            newDescription = null;
        }
        const { error: updateError } = await supabase
            .from('gftvpolicy_images')
            .update({ description: newDescription })
            .eq('id', imageId);
        if (updateError) {
            return sendError(response, 'Failed to update description');
        }
        return sendSuccess(response, { updated: true });
    }

    return sendError(response, 'Method not allowed', 405);
};
