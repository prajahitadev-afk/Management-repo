import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL || 'https://rysoqgtpbmafoybvylke.supabase.co', process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5c29xZ3RwYm1hZm95YnZ5bGtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3MzczMTcsImV4cCI6MjEwMDMxMzMxN30.Tp2ntKwAX77WT5_YFeF3GeOXF05x8l6i5JXEJMQ7CAU');
const tables=['attendance','profiles','bills','bill_history','orders','order_items','customers','deliveries','vehicles','drivers','delivery_tracking','program_impact'];
for (const table of tables) {
  try {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    console.log(table, 'OK', error ? 'ERR:'+error.message : (data?.length ?? 0), data?.[0] ? Object.keys(data[0]).join(',') : '');
  } catch (e) {
    console.log(table, 'THROW', e.message);
  }
}
