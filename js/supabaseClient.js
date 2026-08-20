// Cliente de Supabase, inicializado una sola vez a partir de js/config.js.
// "db" evita chocar con el objeto global "supabase" que expone el script del CDN.
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
