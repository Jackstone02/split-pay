import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://quvlrsdtrxjikyipxlhd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1dmxyc2R0cnhqaWt5aXB4bGhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0ODQ4MTcsImV4cCI6MjA4MjA2MDgxN30.uOUrGuXMOkpFRhHzgHRA6rzWG-L8JEg7R7tEUPFyc-w';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
