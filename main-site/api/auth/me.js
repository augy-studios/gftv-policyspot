// api/auth/me.js
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
    if (req.method !== 'GET') return err(res, 'Method not allowed', 405);
    const user = await validateSession(req);
    if (!user) return err(res, 'Unauthorized', 401);
    const {
        password_hash,
        totp_secret,
        ...safeUser
    } = user;
    return ok(res, {
        user: safeUser
    });
};