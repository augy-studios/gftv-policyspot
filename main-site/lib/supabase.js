// lib/supabase.js - Shared Supabase client for serverless functions
const {
    createClient
} = require('@supabase/supabase-js');

function getSupabaseClient() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Missing Supabase environment variables');
    return createClient(url, key);
}

module.exports = {
    getSupabaseClient
};