import React from 'react';

const DataTable = ({ data }) => {
  if (!data?.length) return <div className="py-12 text-center text-[#A9C5B4]">No data</div>;
  // Hide internal sorting helper columns from the UI
  const hiddenKeys = new Set(['rank_display']);
  // Also hide display fields and used markers from the table body
  const displayKeys = new Set();
  Object.keys(data[0]).forEach(k => {
    if (k.startsWith('_display_') || k.startsWith('_used_')) displayKeys.add(k);
  });
  const headers = Object.keys(data[0]).filter(h => !hiddenKeys.has(h) && !displayKeys.has(h));
  
  // Build header display map (for columns with _display_ prefix)
  const headerDisplayMap = {};
  headers.forEach(h => {
    const displayKey = `_display_${h}`;
    if (data[0][displayKey]) {
      headerDisplayMap[h] = data[0][displayKey];
    }
  });
  
  return (
    <div className="rounded-lg border border-[#D4AF37]/20 bg-[#0F2C1D]/80 backdrop-blur-md overflow-hidden shadow-2xl" data-testid="table-container">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-[#0A2A1A] border-b border-[#D4AF37]/30">
              {headers.map((h, i) => {
                // TEAM COMMENTED OUT: const isName = h.toLowerCase() === 'player' || h.toLowerCase() === 'team';
                const isName = h.toLowerCase() === 'player';
                const displayHeader = headerDisplayMap[h] || h;
                return (
                  <th key={i} className={`py-4 px-4 text-xs font-sans tracking-[0.15em] uppercase text-[#A9C5B4] ${isName ? 'text-left' : 'text-center'}`}>
                    {displayHeader}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {data.map((row, ri) => {
              const rankDisp = row.rank_display || (row.rank ? String(row.rank) : null);
              const numericRank = parseInt(row.rank);
              const isTopThree = numericRank >= 1 && numericRank <= 3;
              return (
                <tr key={ri} className={`${ri % 2 === 0 ? 'bg-transparent' : 'bg-[#FFFFFF]/5'} hover:bg-[#163A27] transition-colors ${isTopThree ? 'border-l-2 border-[#D4AF37]' : ''}`}>
                  {headers.map((k, ci) => {
                    const v = row[k];
                    // TEAM COMMENTED OUT: const isName = k.toLowerCase() === 'player' || k.toLowerCase() === 'team';
                    const isName = k.toLowerCase() === 'player';
                    const isRankCol = k.toLowerCase() === 'rank';
                    const isUsed = row[`_used_${k}`] === true;
                    return (
                      <td key={ci} className={`py-3 px-4 text-sm font-sans text-white ${isName ? 'text-left' : 'text-center'} ${isUsed ? 'bg-[#D4AF37]/15' : ''}`}>
                        <div className={`flex items-center gap-2 ${isName ? '' : 'justify-center'}`}>
                          {ci === 0 && isTopThree && <span className="inline-flex items-center justify-center rounded-full bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40 px-2 py-0.5 text-xs font-bold">#{numericRank}</span>}
                          <span>{isRankCol && rankDisp ? rankDisp : String(v)}</span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DataTable;
