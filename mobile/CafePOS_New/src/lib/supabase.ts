import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Use Expo public env vars. If missing, run in mock-only mode.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://gxweofraymbcwqxbcsln.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4d2VvZnJheW1iY3dxeGJjc2xuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMzA5NjQsImV4cCI6MjA4NTcwNjk2NH0.7bNRXmW0mcnvGT9DhowlzvM3EpWZ_cX-sX2MQc_Z3hk';

let supabase: SupabaseClient | null = null;
if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey, { 
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
} else {
  console.warn(
    'Supabase not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.'
  );
}

export { supabase };
