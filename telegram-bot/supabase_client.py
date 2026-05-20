from supabase import Client, create_client

from config import SUPABASE_SERVICE_KEY, SUPABASE_URL

client: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
