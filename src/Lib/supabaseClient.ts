import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ufgtwdwofzowzrlccuun.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Q68w-WKgLG3ahXOmJGKe6g_3GR3Ihzh';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
