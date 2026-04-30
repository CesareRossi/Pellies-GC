import React from 'react';

const TeamScorecard = ({ data, title, jokerHole = null, beerHole = null }) => {
  if (!data || !data.length) {
    return (
      <div className="text-center py-12 text-[#A9C5B4]">
        No team scorecard data available
      </div>
    );
  }

  // Extract hole information and team data
  const holeRows = data.filter(row => row.Team !== 'Total');
  const totalRow = data.find(row => row.Team === 'Total');
  
  // Get team names (exclude Team column)
  const teamNames = holeRows.length > 0 && holeRows[0] 
    ? Object.keys(holeRows[0]).filter(key => key !== 'Team')
    : [];

  // Split holes into front 9 and back 9
  const front9Holes = holeRows.filter(row => {
    if (!row.Team) return false;
    const holeNum = parseInt(row.Team.replace('H', ''));
    return !isNaN(holeNum) && holeNum <= 9;
  });
  const back9Holes = holeRows.filter(row => {
    if (!row.Team) return false;
    const holeNum = parseInt(row.Team.replace('H', ''));
    return !isNaN(holeNum) && holeNum >= 10;
  });

  // Calculate totals for each section
  const calculateSectionTotals = (holes, teams) => {
    const totals = {};
    teams.forEach(team => {
      totals[team] = holes.reduce((sum, hole) => sum + (hole[team] || 0), 0);
    });
    return totals;
  };

  const front9Totals = calculateSectionTotals(front9Holes, teamNames);
  const back9Totals = calculateSectionTotals(back9Holes, teamNames);

  // Helper to get visual indicator for stableford points
  const getScoreIndicator = (points) => {
    if (!points || points === '') {
      return { bg: 'bg-transparent', text: 'text-white', border: 'border-[#A9C5B4]/30', shape: 'none' };
    }
    if (points >= 4) return { bg: 'bg-[#D4AF37]', text: 'text-[#051A10]', border: 'border-[#D4AF37]', shape: 'circle' }; // Eagle+
    if (points === 3) return { bg: 'bg-emerald-400', text: 'text-[#051A10]', border: 'border-emerald-400', shape: 'circle' }; // Birdie
    if (points === 2) return { bg: 'bg-white', text: 'text-[#051A10]', border: 'border-white', shape: 'square' }; // Par
    if (points === 1) return { bg: 'bg-[#051A10]', text: 'text-white', border: 'border-white', shape: 'square' }; // Bogey
    if (points === 0) return { bg: 'bg-[#051A10]', text: 'text-white', border: 'border-white', shape: 'square' }; // Double+
    return { bg: 'bg-transparent', text: 'text-white', border: 'border-[#A9C5B4]/30', shape: 'none' };
  };

  // Helper to render score cell with visual indicator
  const renderScoreCell = (points) => {
    const style = getScoreIndicator(points);
    const value = points || '';
    
    if (style.shape === 'circle') {
      return (
        <div className={`w-8 h-8 mx-auto rounded-full ${style.bg} ${style.border} border-2 flex items-center justify-center ${style.text} font-bold text-sm`}>
          {value}
        </div>
      );
    }
    
    if (style.shape === 'square') {
      return (
        <div className={`w-8 h-8 mx-auto ${style.bg} ${style.border} border-2 flex items-center justify-center ${style.text} font-bold text-sm`}>
          {value}
        </div>
      );
    }
    
    return <span className={`text-sm font-bold ${style.text}`}>{value}</span>;
  };

  // Format team names for display (truncate if too long)
  const formatTeamName = (name) => {
    if (name.length <= 20) return name;
    const parts = name.split(' and ');
    if (parts.length === 2) {
      const p1 = parts[0].length > 10 ? parts[0].substring(0, 8) + '...' : parts[0];
      const p2 = parts[1].length > 10 ? parts[1].substring(0, 8) + '...' : parts[1];
      return `${p1} & ${p2}`;
    }
    return name.substring(0, 18) + '...';
  };

  return (
    <div className="team-scorecard">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-serif text-[#D4AF37] mb-2">{title}</h2>
        <p className="text-sm text-[#A9C5B4]">Best Ball Stableford Format</p>
      </div>

      {/* Scorecard Grid with horizontal scrolling */}
      <div className="overflow-x-auto">
        <div className="rounded-xl border border-[#D4AF37]/20 bg-[#0F2C1D]/90 backdrop-blur-md overflow-hidden shadow-2xl min-w-max">
        
        {/* Header Row - TEAM | HOLE NUMBERS 1-9 | OUT | HOLE NUMBERS 10-18 | IN | TOT */}
        <div className="bg-[#051A10] border-b border-[#D4AF37]/30">
          <div className="grid grid-cols-13">
            <div className="px-3 py-3 text-xs font-sans text-white font-bold uppercase tracking-wider border-r border-[#D4AF37]/30">TEAM</div>
            {[1,2,3,4,5,6,7,8,9].map(num => {
              const isJokerHole = jokerHole && num === jokerHole;
              const isBeerHole = beerHole && num === beerHole;
              const hasIndicator = isJokerHole || isBeerHole;
              
              return (
                <div key={num} className="px-2 py-3 text-center text-sm font-bold text-white border-r border-[#D4AF37]/30 relative">
                  {num}
                  {hasIndicator && (
                    <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 ${
                      isJokerHole 
                        ? 'bg-purple-500 border-purple-300 shadow-purple-500/70 shadow-md' 
                        : 'bg-amber-500 border-amber-300 shadow-amber-500/70 shadow-md'
                    }`}></div>
                  )}
                </div>
              );
            })}
            <div className="px-2 py-3 text-center text-sm font-bold text-white border-r border-[#D4AF37]/30">OUT</div>
            {[10,11,12,13,14,15,16,17,18].map(num => {
              const isJokerHole = jokerHole && num === jokerHole;
              const isBeerHole = beerHole && num === beerHole;
              const hasIndicator = isJokerHole || isBeerHole;
              
              return (
                <div key={num} className="px-2 py-3 text-center text-sm font-bold text-white border-r border-[#D4AF37]/30 relative">
                  {num}
                  {hasIndicator && (
                    <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 ${
                      isJokerHole 
                        ? 'bg-purple-500 border-purple-300 shadow-purple-500/70 shadow-md' 
                        : 'bg-amber-500 border-amber-300 shadow-amber-500/70 shadow-md'
                    }`}></div>
                  )}
                </div>
              );
            })}
            <div className="px-2 py-3 text-center text-sm font-bold text-white border-r border-[#D4AF37]/30">IN</div>
            <div className="px-2 py-3 text-center text-sm font-bold text-white">TOT</div>
          </div>
        </div>

        {/* Team Rows - Single Line with All 18 Holes + Totals */}
        {teamNames.map((team, teamIndex) => (
          <div key={team} className={`${teamIndex % 2 === 0 ? 'bg-[#0F2C1D]/40' : 'bg-[#051A10]/20'} border-b border-[#D4AF37]/10 last:border-b-0`}>
            <div className="grid grid-cols-13">
              <div className="px-3 py-3 text-sm font-semibold text-white border-r border-[#D4AF37]/20 flex items-center" title={team}>
                {formatTeamName(team)}
              </div>
              {/* Front 9 holes */}
              {front9Holes.map(hole => (
                <div key={hole.Team} className="px-2 py-3 text-center border-r border-[#D4AF37]/10 flex items-center justify-center">
                  {renderScoreCell(hole[team])}
                </div>
              ))}
              {/* OUT total */}
              <div className="px-2 py-3 text-center border-r border-[#D4AF37]/10 flex items-center justify-center">
                <span className="text-lg font-bold text-[#D4AF37]">{front9Totals[team]}</span>
              </div>
              {/* Back 9 holes */}
              {back9Holes.map(hole => (
                <div key={hole.Team} className="px-2 py-3 text-center border-r border-[#D4AF37]/10 flex items-center justify-center">
                  {renderScoreCell(hole[team])}
                </div>
              ))}
              {/* IN total */}
              <div className="px-2 py-3 text-center border-r border-[#D4AF37]/10 flex items-center justify-center">
                <span className="text-lg font-bold text-[#D4AF37]">{back9Totals[team]}</span>
              </div>
              {/* TOT total */}
              <div className="px-2 py-3 text-center flex items-center justify-center">
                <span className="text-lg font-bold text-[#D4AF37]">{totalRow?.[team] || 0}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      </div>

      {/* Legend */}
      <div className="mt-6 flex flex-wrap gap-4 justify-center text-xs text-[#A9C5B4] bg-[#0F2C1D]/60 rounded-lg p-4 border border-[#D4AF37]/20">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-[#D4AF37] rounded-full border-2 border-[#D4AF37]"></div>
          <span>Best Ball Eagle+ (4+ pts)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-emerald-400 rounded-full border-2 border-emerald-400"></div>
          <span>Best Ball Birdie (3 pts)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-white border-2 border-white"></div>
          <span>Best Ball Par (2 pts)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-[#051A10] border-2 border-white"></div>
          <span>Best Ball Bogey/Double+ (0-1 pts)</span>
        </div>
      </div>
    </div>
  );
};

export default TeamScorecard;
