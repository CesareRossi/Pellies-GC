import React from 'react';

const TeamScorecard = ({ data, title, jokerHole = null, beerHole = null, mode = 'stableford', playerHandicaps = null }) => {
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
  
  // Get team names (exclude Team and Par columns)
  const teamNames = holeRows.length > 0 && holeRows[0] 
    ? Object.keys(holeRows[0]).filter(key => key !== 'Team' && key !== 'Par')
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
      totals[team] = holes.reduce((sum, hole) => {
        const val = hole[team];
        if (!val) return sum;
        // For stroke play, value is now a number (net strokes)
        if (mode === 'stroke') {
          return sum + (parseInt(val, 10) || 0);
        }
        // For stableford, value is a number (points)
        return sum + (val || 0);
      }, 0);
    });
    return totals;
  };

  const front9Totals = calculateSectionTotals(front9Holes, teamNames);
  const back9Totals = calculateSectionTotals(back9Holes, teamNames);

  // Helper to get visual indicator for stableford points or stroke play net vs par
  const getScoreIndicator = (value, par = null, hasScore = false) => {
    // For teams: only show blank if no score was entered (not if score is 0)
    if (value === '' || value === null || value === undefined) {
      return { bg: 'bg-transparent', text: 'text-white', border: 'border-[#A9C5B4]/30', shape: 'none' };
    }
    
    // For stroke play mode, calculate indicator based on net strokes vs par
    const parNum = parseInt(par, 10);
    if (mode === 'stroke' && !isNaN(parNum) && parNum > 0) {
      const netStrokes = parseInt(value, 10);
      if (isNaN(netStrokes)) return { bg: 'bg-transparent', text: 'text-white', border: 'border-[#A9C5B4]/30', shape: 'none' };
      
      const diff = netStrokes - parNum;
      // Net strokes 2+ under par = Eagle+
      if (diff <= -2) return { bg: 'bg-[#D4AF37]', text: 'text-[#051A10]', border: 'border-[#D4AF37]', shape: 'circle' };
      // Net strokes 1 under par = Birdie
      if (diff === -1) return { bg: 'bg-emerald-400', text: 'text-[#051A10]', border: 'border-emerald-400', shape: 'circle' };
      // Net strokes = par
      if (diff === 0) return { bg: 'bg-white', text: 'text-[#051A10]', border: 'border-white', shape: 'square' };
      // Net strokes 1 over par = Bogey
      if (diff === 1) return { bg: 'bg-[#051A10]', text: 'text-white', border: 'border-white', shape: 'square' };
      // Net strokes 2+ over par = Double+
      return { bg: 'bg-[#051A10]', text: 'text-white', border: 'border-white', shape: 'square' };
    }
    
    // Fallback: For stroke play without par data, use relative scoring indicators
    // Lower is better for stroke play, so 1-2 = great, 3-4 = good, 5+ = poor
    if (mode === 'stroke') {
      const netStrokes = parseInt(value, 10);
      if (isNaN(netStrokes)) return { bg: 'bg-transparent', text: 'text-white', border: 'border-[#A9C5B4]/30', shape: 'none' };
      if (netStrokes <= 2) return { bg: 'bg-[#D4AF37]', text: 'text-[#051A10]', border: 'border-[#D4AF37]', shape: 'circle' }; // Great
      if (netStrokes === 3) return { bg: 'bg-emerald-400', text: 'text-[#051A10]', border: 'border-emerald-400', shape: 'circle' }; // Good
      if (netStrokes === 4) return { bg: 'bg-white', text: 'text-[#051A10]', border: 'border-white', shape: 'square' }; // OK
      return { bg: 'bg-[#051A10]', text: 'text-white', border: 'border-white', shape: 'square' }; // Poor
    }
    
    // For stableford mode (value is points)
    if (value >= 4) return { bg: 'bg-[#D4AF37]', text: 'text-[#051A10]', border: 'border-[#D4AF37]', shape: 'circle' }; // Eagle+
    if (value === 3) return { bg: 'bg-emerald-400', text: 'text-[#051A10]', border: 'border-emerald-400', shape: 'circle' }; // Birdie
    if (value === 2) return { bg: 'bg-white', text: 'text-[#051A10]', border: 'border-white', shape: 'square' }; // Par
    if (value === 1) return { bg: 'bg-[#051A10]', text: 'text-white', border: 'border-white', shape: 'square' }; // Bogey
    if (value === 0) return { bg: 'bg-[#051A10]', text: 'text-red-400', border: 'border-red-500', shape: 'circle' }; // 0 points - red outline
    return { bg: 'bg-transparent', text: 'text-white', border: 'border-[#A9C5B4]/30', shape: 'none' };
  };

  // Helper to render score cell with visual indicator
  const renderScoreCell = (points, par, contributor) => {
    // hasScore is true if contributor is set (meaning a player contributed a score for this hole)
    const hasScore = contributor === '1' || contributor === '2' || contributor === 'T';
    const style = getScoreIndicator(points, par, hasScore);
    const value = (points === 0 || points === '0') ? 0 : (points || '');
    
    if (style.shape === 'circle') {
      return (
        <div className={`w-6 h-6 sm:w-8 sm:h-8 mx-auto rounded-full ${style.bg} ${style.border} border-2 flex items-center justify-center ${style.text} font-bold text-xs sm:text-sm`}>
          {value}
        </div>
      );
    }
    
    if (style.shape === 'square') {
      return (
        <div className={`w-6 h-6 sm:w-8 sm:h-8 mx-auto ${style.bg} ${style.border} border-2 flex items-center justify-center ${style.text} font-bold text-xs sm:text-sm`}>
          {value}
        </div>
      );
    }
    
    // For stroke play with contributor indicator
    if (mode === 'stroke' && contributor && value) {
      return (
        <div className="relative inline-block">
          <span className={`text-xs sm:text-sm font-bold ${style.text}`}>{value}</span>
          <span className="absolute -top-1.5 -right-2.5 sm:-top-2 sm:-right-3 w-3 h-3 sm:w-4 sm:h-4 bg-emerald-400 text-[#051A10] text-[10px] sm:text-xs font-bold rounded-full flex items-center justify-center">
            {contributor}
          </span>
        </div>
      );
    }
    
    return <span className={`text-xs sm:text-sm font-bold ${style.text}`}>{value}</span>;
  };

  // Format team names for display - returns JSX for multi-line if needed
  const formatTeamName = (name) => {
    const parts = name.split(' and ');
    if (parts.length === 2) {
      // Return multi-line format for team names
      return (
        <div className="flex flex-col leading-tight">
          <span>{parts[0]}</span>
          <span className="text-[#A9C5B4] text-[10px]">and</span>
          <span>{parts[1]}</span>
        </div>
      );
    }
    return <span className="truncate">{name}</span>;
  };

  return (
    <div className="team-scorecard">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-serif text-[#D4AF37] mb-2">{title}</h2>
        <p className="text-sm text-[#A9C5B4]">
          {mode === 'stroke' ? 'Best Ball Stroke Play Format (lowest net score)' : 'Best Ball Stableford Format'}
        </p>
      </div>

      {/* Scorecard Grid with horizontal scrolling */}
      <div className="relative overflow-x-auto rounded-xl border border-[#D4AF37]/20 bg-[#0F2C1D]/90 backdrop-blur-md shadow-2xl">
        <div className="min-w-max isolate">
        
        {/* Header Row - TEAM | HOLE NUMBERS 1-9 | OUT | HOLE NUMBERS 10-18 | IN | TOT */}
        <div className="relative bg-[#051A10] border-b border-[#D4AF37]/30">
          <div className="grid grid-cols-13">
            <div className="sticky left-0 z-20 px-2 sm:px-3 py-2 sm:py-3 text-[10px] sm:text-xs font-sans text-white font-bold uppercase tracking-wider border-r border-[#D4AF37]/30 bg-[#051A10]">TEAM</div>
            {[1,2,3,4,5,6,7,8,9].map(num => {
              const isJokerHole = jokerHole && num === jokerHole;
              const isBeerHole = beerHole && num === beerHole;
              const hasIndicator = isJokerHole || isBeerHole;
              
              return (
                <div key={num} className="px-1 sm:px-2 py-2 sm:py-3 text-center text-xs sm:text-sm font-bold text-white border-r border-[#D4AF37]/30 relative">
                  {num}
                  {hasIndicator && (
                    <div className={`absolute -top-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 rounded-full border-2 ${
                      isJokerHole 
                        ? 'bg-purple-500 border-purple-300 shadow-purple-500/70 shadow-md' 
                        : 'bg-amber-500 border-amber-300 shadow-amber-500/70 shadow-md'
                    }`}></div>
                  )}
                </div>
              );
            })}
            <div className="px-1 sm:px-2 py-2 sm:py-3 text-center text-xs sm:text-sm font-bold text-white border-r border-[#D4AF37]/30">OUT</div>
            {[10,11,12,13,14,15,16,17,18].map(num => {
              const isJokerHole = jokerHole && num === jokerHole;
              const isBeerHole = beerHole && num === beerHole;
              const hasIndicator = isJokerHole || isBeerHole;
              
              return (
                <div key={num} className="px-1 sm:px-2 py-2 sm:py-3 text-center text-xs sm:text-sm font-bold text-white border-r border-[#D4AF37]/30 relative">
                  {num}
                  {hasIndicator && (
                    <div className={`absolute -top-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 rounded-full border-2 ${
                      isJokerHole 
                        ? 'bg-purple-500 border-purple-300 shadow-purple-500/70 shadow-md' 
                        : 'bg-amber-500 border-amber-300 shadow-amber-500/70 shadow-md'
                    }`}></div>
                  )}
                </div>
              );
            })}
            <div className="px-1 sm:px-2 py-2 sm:py-3 text-center text-xs sm:text-sm font-bold text-white border-r border-[#D4AF37]/30">IN</div>
            <div className="px-1 sm:px-2 py-2 sm:py-3 text-center text-xs sm:text-sm font-bold text-white">TOT</div>
          </div>
        </div>

        {/* Par Row */}
        <div className="relative bg-[#0A2518] border-b border-[#D4AF37]/20">
          <div className="grid grid-cols-13">
            <div className="sticky left-0 z-20 px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs font-sans text-[#A9C5B4] uppercase tracking-wider border-r border-[#D4AF37]/20" style={{backgroundColor: '#0A2518'}}>PAR</div>
            {front9Holes.map(hole => (
              <div key={hole.Team} className="px-1 sm:px-2 py-1.5 sm:py-2 text-center text-xs sm:text-sm font-semibold text-white border-r border-[#D4AF37]/20">
                {hole.Par}
              </div>
            ))}
            <div className="px-1 sm:px-2 py-1.5 sm:py-2 text-center text-xs sm:text-sm font-semibold text-white border-r border-[#D4AF37]/30">
              {front9Holes.reduce((sum, hole) => sum + (parseInt(hole.Par, 10) || 0), 0)}
            </div>
            {back9Holes.map(hole => (
              <div key={hole.Team} className="px-1 sm:px-2 py-1.5 sm:py-2 text-center text-xs sm:text-sm font-semibold text-white border-r border-[#D4AF37]/20">
                {hole.Par}
              </div>
            ))}
            <div className="px-1 sm:px-2 py-1.5 sm:py-2 text-center text-xs sm:text-sm font-semibold text-white border-r border-[#D4AF37]/30">
              {back9Holes.reduce((sum, hole) => sum + (parseInt(hole.Par, 10) || 0), 0)}
            </div>
            <div className="px-1 sm:px-2 py-1.5 sm:py-2 text-center text-xs sm:text-sm font-semibold text-white">
              {holeRows.reduce((sum, hole) => sum + (parseInt(hole.Par, 10) || 0), 0)}
            </div>
          </div>
        </div>

        {/* Team Rows - Single Line with All 18 Holes + Totals */}
        {teamNames.map((team, teamIndex) => (
          <div key={team} className={`relative ${teamIndex % 2 === 0 ? 'bg-[#0F2C1D]/40' : 'bg-[#051A10]/20'} border-b border-[#D4AF37]/10 last:border-b-0`}>
            <div className="grid grid-cols-13">
              <div className="sticky left-0 z-10 px-2 sm:px-3 py-2 sm:py-3 text-xs sm:text-sm font-semibold text-white border-r border-[#D4AF37]/20 flex items-center" style={{backgroundColor: teamIndex % 2 === 0 ? '#0F2C1D' : '#0A1F14'}} title={team}>
                {formatTeamName(team)}
              </div>
              {/* Front 9 holes */}
              {front9Holes.map(hole => (
                <div key={hole.Team} className="px-1 sm:px-2 py-2 sm:py-3 text-center border-r border-[#D4AF37]/10 flex items-center justify-center">
                  {renderScoreCell(hole[team], hole.Par, hole[`${team}_contributor`])}
                </div>
              ))}
              {/* OUT total */}
              <div className="px-1 sm:px-2 py-2 sm:py-3 text-center border-r border-[#D4AF37]/10 flex items-center justify-center">
                <span className="text-base sm:text-lg font-bold text-[#D4AF37]">{front9Totals[team]}</span>
              </div>
              {/* Back 9 holes */}
              {back9Holes.map(hole => (
                <div key={hole.Team} className="px-1 sm:px-2 py-2 sm:py-3 text-center border-r border-[#D4AF37]/10 flex items-center justify-center">
                  {renderScoreCell(hole[team], hole.Par, hole[`${team}_contributor`])}
                </div>
              ))}
              {/* IN total */}
              <div className="px-1 sm:px-2 py-2 sm:py-3 text-center border-r border-[#D4AF37]/10 flex items-center justify-center">
                <span className="text-base sm:text-lg font-bold text-[#D4AF37]">{back9Totals[team]}</span>
              </div>
              {/* TOT total */}
              <div className="px-1 sm:px-2 py-2 sm:py-3 text-center flex items-center justify-center">
                <span className="text-base sm:text-lg font-bold text-[#D4AF37]">{totalRow?.[team] || 0}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      </div>

      {/* Legend */}
      {mode === 'stroke' ? (
        <div className="mt-6 flex flex-wrap gap-4 justify-center text-xs text-[#A9C5B4] bg-[#0F2C1D]/60 rounded-lg p-4 border border-[#D4AF37]/20">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#D4AF37] rounded-full border-2 border-[#D4AF37]"></div>
            <span>Best Ball Eagle+ (2+ under par)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-emerald-400 rounded-full border-2 border-emerald-400"></div>
            <span>Best Ball Birdie (1 under par)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-white border-2 border-white"></div>
            <span>Best Ball Par</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#051A10] border-2 border-white"></div>
            <span>Best Ball Bogey/Double+ (1+ over par)</span>
          </div>
        </div>
      ) : (
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
      )}
    </div>
  );
};

export default TeamScorecard;
