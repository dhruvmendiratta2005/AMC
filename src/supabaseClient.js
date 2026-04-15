import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zbqgisfagqeprfxwtsnx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpicWdpc2ZhZ3FlcHJmeHd0c254Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNDA0ODksImV4cCI6MjA5MTgxNjQ4OX0.l4jXv7dMnVvpX33SxAdIRcxOh0Z1P_eGOJC18Zxuzjc';
export const supabase = createClient(supabaseUrl, supabaseKey);
