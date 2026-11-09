// lib/response.js - Standard API response helpers

/**
 * Sends a successful JSON response. The fields in "responseData" are merged
 * into the top level of the JSON body next to "ok: true".
 */
function sendSuccess(response, responseData, statusCode = 200) {
    response.status(statusCode).json({
        ok: true,
        ...responseData
    });
}

/**
 * Sends a failed JSON response containing "ok: false" and an error message.
 */
function sendError(response, errorMessage, statusCode = 400) {
    response.status(statusCode).json({
        ok: false,
        error: errorMessage
    });
}

/**
 * Browsers send an "OPTIONS" request before some cross-origin requests.
 * This answers it straight away and returns true so the caller can stop.
 * For every other request method it does nothing and returns false.
 */
function handleOptions(request, response) {
    if (request.method === 'OPTIONS') {
        response.status(200).end();
        return true;
    }
    return false;
}

module.exports = {
    sendSuccess,
    sendError,
    handleOptions
};
