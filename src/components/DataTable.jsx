import React, { useMemo } from 'react';

/**
 * League leaderboard table.
 *
 * Row shape from the service is:
 *   { rank, rank_display, player, "R1 Koro Creek": 31, _display_…, _used_…, total }
 *
 * Three things this has to get right that a naive table does not:
 *  1. Round columns are keyed "R<n> <course>" but the `_display_` field drops
 *     the number — with a dozen rounds at Pebble Rock that produced a dozen
 *     identical headers. We show the round number above the course name.
 *  2. Rank and Player are both frozen to the left, and Total to the right, so
 *     you never lose the name or the score while scrolling 39 columns.
 *  3. `_used_<key>` marks the rounds that counted toward the total; that gets
 *     an explicit legend rather than an unexplained gold tint.
 */

const RANK_W = 68;
const PLAYER_W = 150;

const DataTable = ({ data }) => {
  const model = useMemo(() => {
    if (!data?.length) return null;

    const first = data[0];
    const hiddenKeys = new Set(['rank_display']);
    const metaKeys = new Set();
    Object.keys(first).forEach((k) => {
      if (k.startsWith('_display_') || k.startsWith('_used_')) metaKeys.add(k);
    });

    const headers = Object.keys(first).filter((h) => !hiddenKeys.has(h) && !metaKeys.has(h));

    const columns = headers.map((key) => {
      const lower = key.toLowerCase();
      const roundMatch = /^R(\d+)\s+(.*)$/.exec(key);
      return {
        key,
        isRank: lower === 'rank',
        isPlayer: lower === 'player',
        isTotal: lower === 'total',
        roundNo: roundMatch ? roundMatch[1] : null,
        // Prefer the service-supplied display name, else the parsed course,
        // else the raw key.
        label: first[`_display_${key}`] || (roundMatch ? roundMatch[2] : key),
      };
    });

    const anyCounted = data.some((row) => Object.keys(row).some((k) => k.startsWith('_used_') && row[k] === true));

    return { columns, anyCounted };
  }, [data]);

  if (!data?.length) {
    return (
      <div className="pg-card px-6 py-16 text-center">
        <p className="text-sm text-[#A9C5B4]">No leaderboard data yet.</p>
      </div>
    );
  }

  const { columns, anyCounted } = model;

  return (
    <div>
      {anyCounted && (
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="flex items-center gap-2 text-[11px] text-[#A9C5B4]">
            <span className="pg-cell-counted inline-block h-3.5 w-6 rounded-[3px]" />
            Counts toward the total
          </span>
          <span className="flex items-center gap-2 text-[11px] text-[#A9C5B4]">
            <span className="inline-block h-3.5 w-6 rounded-[3px] border border-[#D4AF37]/15 bg-white/4" />
            Played, not counted
          </span>
          <span className="text-[11px] text-[#A9C5B4]/60">— = did not play</span>
        </div>
      )}

      <div className="pg-card overflow-hidden" data-testid="table-container">
        <div className="pg-scroll max-h-[70vh] overflow-auto">
          <table className="pg-table">
            <thead>
              <tr>
                {columns.map((c) => {
                  const sticky = c.isRank || c.isPlayer || c.isTotal;
                  const style = c.isRank
                    ? { left: 0, minWidth: RANK_W }
                    : c.isPlayer
                    ? { left: RANK_W, minWidth: PLAYER_W }
                    : c.isTotal
                    ? { right: 0, minWidth: 78 }
                    : { minWidth: 72 };
                  return (
                    <th
                      key={c.key}
                      scope="col"
                      style={style}
                      className={[
                        sticky ? 'pg-col-sticky' : '',
                        c.isPlayer ? 'pg-col-sticky-left-edge text-left' : '',
                        c.isTotal ? 'pg-col-sticky-right-edge' : '',
                        c.isRank ? 'text-left' : c.isPlayer ? 'text-left' : 'text-center',
                        c.isTotal ? 'text-[#D4AF37]' : '',
                      ].join(' ')}
                    >
                      {c.roundNo ? (
                        <span className="flex flex-col items-center gap-0.5 leading-tight">
                          <span className="pg-num text-[9px] font-bold text-[#D4AF37]/75">R{c.roundNo}</span>
                          <span className="max-w-[84px] truncate text-[9.5px] font-semibold normal-case tracking-normal text-[#A9C5B4]" title={c.label}>
                            {c.label}
                          </span>
                        </span>
                      ) : (
                        c.label
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {data.map((row, ri) => {
                const numericRank = parseInt(row.rank, 10);
                const isTopThree = numericRank >= 1 && numericRank <= 3;
                const rankDisplay = row.rank_display || (row.rank ? String(row.rank) : '—');

                return (
                  <tr key={ri} data-testid={`lb-row-${ri}`}>
                    {columns.map((c) => {
                      const sticky = c.isRank || c.isPlayer || c.isTotal;
                      const style = c.isRank
                        ? { left: 0, minWidth: RANK_W }
                        : c.isPlayer
                        ? { left: RANK_W, minWidth: PLAYER_W }
                        : c.isTotal
                        ? { right: 0, minWidth: 78 }
                        : { minWidth: 72 };

                      const value = row[c.key];
                      const isCounted = row[`_used_${c.key}`] === true;
                      const played = value !== '-' && value !== '' && value != null;

                      let content;
                      if (c.isRank) {
                        // One rank chip only — the old markup printed the badge
                        // and the number side by side ("#1 1").
                        content = (
                          <span
                            className={`pg-num inline-flex min-w-[30px] items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
                              isTopThree
                                ? 'border border-[#D4AF37]/45 bg-[#D4AF37]/18 text-[#D4AF37]'
                                : 'text-[#A9C5B4]'
                            }`}
                          >
                            {rankDisplay}
                          </span>
                        );
                      } else if (c.isPlayer) {
                        content = <span className="truncate font-semibold">{String(value ?? '')}</span>;
                      } else if (c.isTotal) {
                        content = <span className="pg-num font-bold text-[#D4AF37]">{String(value ?? '')}</span>;
                      } else {
                        content = (
                          <span className={`pg-num ${played ? '' : 'text-[#A9C5B4]/35'}`}>
                            {played ? String(value) : '–'}
                          </span>
                        );
                      }

                      return (
                        <td
                          key={c.key}
                          style={style}
                          className={[
                            sticky ? 'pg-col-sticky' : '',
                            c.isPlayer ? 'pg-col-sticky-left-edge text-left' : '',
                            c.isTotal ? 'pg-col-sticky-right-edge text-center' : '',
                            c.isRank || c.isPlayer ? 'text-left' : 'text-center',
                            isCounted && !sticky ? 'pg-cell-counted' : '',
                            isTopThree && c.isRank ? 'shadow-[inset_2px_0_0_0_#D4AF37]' : '',
                          ].join(' ')}
                        >
                          {content}
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

      <p className="mt-2.5 text-[11px] text-[#A9C5B4]/55">
        Scroll sideways for every round — rank, player and total stay pinned.
      </p>
    </div>
  );
};

export default DataTable;
