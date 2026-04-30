import React from 'react';

const GolfScorecard = ({ data, title, currentUser = null, jokerHole = null, beerHole = null }) => {
  if (!data || !data.length) {
    return (
      <div className="text-center py-12 text-[#A9C5B4]">
        No scorecard data available
      </div>
    );
  }

  // Extract hole information and player data
  const holeRows = data.filter(row => row.Hole !== 'TOTAL');
  const totalRow = data.find(row => row.Hole === 'TOTAL');
  
  // Get player names (exclude Hole, Par, SI columns)
  const playerNames = holeRows.length > 0 && holeRows[0] 
    ? Object.keys(holeRows[0]).filter(key => !['Hole', 'Par', 'SI'].includes(key))
    : [];

  // Split holes into front 9 and back 9
  const front9Holes = holeRows.filter(row => row.Hole <= 9);
  const back9Holes = holeRows.filter(row => row.Hole >= 10);

  // Calculate totals for each section
  const calculateSectionTotals = (holes, players) => {
    const totals = {};
    players.forEach(player => {
      totals[player] = holes.reduce((sum, hole) => sum + (hole[player] || 0), 0);
    });
    return totals;
  };

  const front9Totals = calculateSectionTotals(front9Holes, playerNames);
  const back9Totals = calculateSectionTotals(back9Holes, playerNames);

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

  return (
    <div className="golf-scorecard">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-serif text-[#D4AF37] mb-2">{title}</h2>
      </div>

      {/* Scorecard Grid with horizontal scrolling */}
      <div className="overflow-x-auto">
        <div className="rounded-xl border border-[#D4AF37]/20 bg-[#0F2C1D]/90 backdrop-blur-md overflow-hidden shadow-2xl min-w-max">
        
        {/* Header Row - PLAYER | HOLE NUMBERS 1-9 | OUT | HOLE NUMBERS 10-18 | IN | TOT */}
        <div className="bg-[#051A10] border-b border-[#D4AF37]/30">
          <div className="grid grid-cols-13">
            <div className="px-3 py-3 text-xs font-sans text-white font-bold uppercase tracking-wider border-r border-[#D4AF37]/30">PLAYER</div>
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

        {/* Par Row */}
        <div className="bg-[#0A2A1A]/50 border-b border-[#D4AF37]/20">
          <div className="grid grid-cols-13">
            <div className="px-3 py-2 text-xs font-sans text-[#A9C5B4] uppercase tracking-wider border-r border-[#D4AF37]/20">PAR</div>
            {front9Holes.map(hole => (
              <div key={hole.Hole} className="px-2 py-2 text-center text-sm font-semibold text-white border-r border-[#D4AF37]/20">
                {hole.Par}
              </div>
            ))}
            <div className="px-2 py-2 text-center text-sm font-semibold text-white border-r border-[#D4AF37]/30">
              {front9Holes.reduce((sum, hole) => sum + hole.Par, 0)}
            </div>
            {back9Holes.map(hole => (
              <div key={hole.Hole} className="px-2 py-2 text-center text-sm font-semibold text-white border-r border-[#D4AF37]/20">
                {hole.Par}
              </div>
            ))}
            <div className="px-2 py-2 text-center text-sm font-semibold text-white border-r border-[#D4AF37]/30">
              {back9Holes.reduce((sum, hole) => sum + hole.Par, 0)}
            </div>
            <div className="px-2 py-2 text-center text-sm font-semibold text-white">
              {holeRows.reduce((sum, hole) => sum + hole.Par, 0)}
            </div>
          </div>
        </div>

        {/* Stroke Index Row */}
        <div className="bg-[#0F2C1D] border-b border-[#D4AF37]/20">
          <div className="grid grid-cols-13">
            <div className="px-3 py-2 text-xs font-sans text-[#A9C5B4] uppercase tracking-wider border-r border-[#D4AF37]/20">SI</div>
            {front9Holes.map(hole => (
              <div key={hole.Hole} className="px-2 py-2 text-center text-sm text-[#A9C5B4] border-r border-[#D4AF37]/20">
                {hole.SI}
              </div>
            ))}
            <div className="px-2 py-2 text-center text-sm text-[#A9C5B4] border-r border-[#D4AF37]/30"></div>
            {back9Holes.map(hole => (
              <div key={hole.Hole} className="px-2 py-2 text-center text-sm text-[#A9C5B4] border-r border-[#D4AF37]/20">
                {hole.SI}
              </div>
            ))}
            <div className="px-2 py-2 text-center text-sm text-[#A9C5B4] border-r border-[#D4AF37]/30"></div>
            <div className="px-2 py-2 text-center text-sm text-[#A9C5B4]"></div>
          </div>
        </div>

        {/* Player Rows - Single Line with All 18 Holes + Totals */}
        {playerNames.map((player, playerIndex) => (
          <div key={player} className={`${playerIndex % 2 === 0 ? 'bg-[#0F2C1D]/40' : 'bg-[#051A10]/20'} border-b border-[#D4AF37]/10 last:border-b-0`}>
            <div className="grid grid-cols-13">
              <div className="px-3 py-3 text-sm font-semibold text-white border-r border-[#D4AF37]/20 flex items-center gap-2">
                {player}
                {currentUser && player === currentUser && (
                  <span className="px-2 py-1 bg-emerald-400 text-[#051A10] text-xs font-bold rounded-full">YOU</span>
                )}
              </div>
              {/* Front 9 holes */}
              {front9Holes.map(hole => (
                <div key={hole.Hole} className="px-2 py-3 text-center border-r border-[#D4AF37]/10 flex items-center justify-center">
                  {renderScoreCell(hole[player])}
                </div>
              ))}
              {/* OUT total */}
              <div className="px-2 py-3 text-center border-r border-[#D4AF37]/10 flex items-center justify-center">
                <span className="text-lg font-bold text-[#D4AF37]">{front9Totals[player]}</span>
              </div>
              {/* Back 9 holes */}
              {back9Holes.map(hole => (
                <div key={hole.Hole} className="px-2 py-3 text-center border-r border-[#D4AF37]/10 flex items-center justify-center">
                  {renderScoreCell(hole[player])}
                </div>
              ))}
              {/* IN total */}
              <div className="px-2 py-3 text-center border-r border-[#D4AF37]/10 flex items-center justify-center">
                <span className="text-lg font-bold text-[#D4AF37]">{back9Totals[player]}</span>
              </div>
              {/* TOT total */}
              <div className="px-2 py-3 text-center flex items-center justify-center">
                <span className="text-lg font-bold text-[#D4AF37]">{totalRow?.[player] || 0}</span>
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
          <span>Eagle+ (4+ pts)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-emerald-400 rounded-full border-2 border-emerald-400"></div>
          <span>Birdie (3 pts)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-white border-2 border-white"></div>
          <span>Par (2 pts)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-[#051A10] border-2 border-white"></div>
          <span>Bogey/Double+ (0-1 pts)</span>
        </div>
      </div>
    </div>
  );
};

export default GolfScorecard;
