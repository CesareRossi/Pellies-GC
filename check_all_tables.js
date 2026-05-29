const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://djalydmfpdfpdarocmto.supabase.co';
const supabaseKey = 'sb_publishable_cpgvQJ8un2BAjnWqPyH2jw_2U1U3Kh3';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAllTables() {
  try {
    // Get all rounds
    const { data: rounds } = await supabase
      .from('rounds')
      .select('id, round_number, courses(name)')
      .order('round_number');
    
    console.log('\n=== ROUNDS IN DATABASE ===');
    rounds.forEach(r => {
      console.log(`Round ${r.round_number} (ID: ${r.id}): ${r.courses?.name || 'No Course'}`);
    });

    // Check scores table
    const { data: scores, error: scoresError } = await supabase
      .from('scores')
      .select('round_id, player_id, hole_number, strokes')
      .order('round_id');
    
    if (scoresError) {
      console.error('Error fetching scores:', scoresError);
    } else {
      console.log('\n=== SCORES TABLE ===');
      console.log(`Total score entries: ${scores.length}`);
      
      const scoresByRound = {};
      for (const s of scores) {
        if (!scoresByRound[s.round_id]) scoresByRound[s.round_id] = 0;
        scoresByRound[s.round_id]++;
      }
      
      for (const round of rounds) {
        const count = scoresByRound[round.id] || 0;
        console.log(`Round ${round.round_number} (ID: ${round.id}): ${count} score entries`);
      }
    }

    // Check if there are any other score-related tables
    const { data: tables } = await supabase
      .from('pg_tables')
      .select('tablename')
      .eq('schemaname', 'public')
      .ilike('tablename', '%score%');
    
    if (tables && tables.length > 0) {
      console.log('\n=== SCORE-RELATED TABLES ===');
      tables.forEach(t => console.log(`  ${t.tablename}`));
    }

  } catch (err) {
    console.error('Error:', err);
  }
}

checkAllTables();
