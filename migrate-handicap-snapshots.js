// Migration script to backfill handicap snapshots for existing rounds
// This script will populate the round_player_handicaps table with current player handicaps
// for all existing rounds and participants
//
// IMPORTANT: This script requires the SERVICE_ROLE_KEY to bypass RLS policies
// Set SUPABASE_SERVICE_ROLE_KEY environment variable before running

const { createClient } = require('@supabase/supabase-js');

// Replace with your Supabase URL and Service Role Key (not Anon Key)
const supabaseUrl = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SUPABASE_SERVICE_ROLE_KEY';

if (!supabaseKey || supabaseKey === 'YOUR_SUPABASE_SERVICE_ROLE_KEY') {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.error('This script needs the service role key to bypass RLS policies');
  console.error('Get your service role key from: https://supabase.com/dashboard/project/_/settings/api');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateHandicapSnapshots() {
  console.log('Starting handicap snapshot migration...');
  
  try {
    // Fetch all rounds
    const { data: rounds, error: roundsError } = await supabase
      .from('rounds')
      .select('id, round_number, courses(name)');
    
    if (roundsError) throw roundsError;
    console.log(`Found ${rounds.length} rounds`);
    
    // Fetch all players
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('id, name, handicap');
    
    if (playersError) throw playersError;
    console.log(`Found ${players.length} players`);
    
    // Build a map of player handicaps
    const playerHandicapMap = {};
    for (const p of players) {
      playerHandicapMap[p.id] = p.handicap || 0;
    }
    
    let totalSnapshots = 0;
    let processedRounds = 0;
    
    // For each round, fetch scores to determine actual participants
    for (const round of rounds) {
      // Fetch scores for this round to determine who actually participated
      const { data: scores, error: scoresError } = await supabase
        .from('scores')
        .select('player_id')
        .eq('round_id', round.id);
      
      if (scoresError) {
        console.error(`  Error fetching scores for round ${round.round_number}:`, scoresError);
        continue;
      }
      
      // Get unique player IDs from scores
      const participantIds = new Set(scores.map(s => s.player_id));
      
      if (participantIds.size === 0) {
        console.log(`Round ${round.round_number}: No scores found, skipping`);
        continue;
      }
      
      console.log(`Round ${round.round_number} (${round.courses?.name}): Processing ${participantIds.size} participants`);
      
      // Create handicap snapshots for all participants
      const snapshots = [];
      for (const playerId of participantIds) {
        snapshots.push({
          round_id: round.id,
          player_id: playerId,
          handicap_index: playerHandicapMap[playerId] || 0
        });
      }
      
      // Batch insert snapshots
      const { error: insertError } = await supabase
        .from('round_player_handicaps')
        .upsert(snapshots, { onConflict: 'round_id,player_id' });
      
      if (insertError) {
        console.error(`  Error inserting snapshots for round ${round.round_number}:`, insertError);
      } else {
        totalSnapshots += snapshots.length;
        processedRounds++;
        console.log(`  ✓ Created ${snapshots.length} handicap snapshots`);
      }
    }
    
    console.log('\n=== Migration Complete ===');
    console.log(`Processed rounds: ${processedRounds}/${rounds.length}`);
    console.log(`Total handicap snapshots created: ${totalSnapshots}`);
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
migrateHandicapSnapshots()
  .then(() => {
    console.log('Migration script finished successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });
