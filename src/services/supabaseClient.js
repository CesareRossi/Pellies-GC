import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://djalydmfpdfpdarocmto.supabase.co';
const supabaseKey = process.env.REACT_APP_SUPABASE_KEY || 'sb_publishable_cpgvQJ8un2BAjnWqPyH2jw_2U1U3Kh3';

export const supabase = createClient(supabaseUrl, supabaseKey);
