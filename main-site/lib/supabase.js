// lib/supabase.js - Shared Supabase client for serverless functions
const {
    createClient
} = require('@supabase/supabase-js');

/**
 * Creates a Supabase client using the server-side service key.
 * Throws an error if the required environment variables are missing.
 */
function getSupabaseClient() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Missing Supabase environment variables');
    }
    return createClient(supabaseUrl, supabaseServiceKey);
}

module.exports = {
    getSupabaseClient
};
