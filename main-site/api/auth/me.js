// api/auth/me.js - Returns the currently signed-in user.
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
    if (request.method !== 'GET') {
        return sendError(response, 'Method not allowed', 405);
    }
    const user = await validateSession(request);
    if (!user) {
        return sendError(response, 'Unauthorized', 401);
    }
    // Remove the secret fields so they are never sent to the browser
    const {
        password_hash: removedPasswordHash,
        totp_secret: removedTotpSecret,
        ...safeUser
    } = user;
    return sendSuccess(response, {
        user: safeUser
    });
};
