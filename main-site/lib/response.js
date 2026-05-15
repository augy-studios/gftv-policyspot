// lib/response.js - Standard API response helpers
function ok(res, data, status = 200) {
    res.status(status).json({
        ok: true,
        ...data
    });
}

function err(res, message, status = 400) {
    res.status(status).json({
        ok: false,
        error: message
    });
}

function handleOptions(req, res) {
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return true;
    }
    return false;
}
module.exports = {
    ok,
    err,
    handleOptions
};