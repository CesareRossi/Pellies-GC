/** Parse par/SI input — empty string stays empty while editing. */
export function parseHoleField(value) {
  if (value === '' || value == null) return '';
  const n = parseInt(String(value), 10);
  return Number.isNaN(n) ? '' : n;
}

export function normalizeHolesForSave(holes) {
  return holes.map(h => ({
    hole_number: h.hole_number,
    par: Number(h.par),
    stroke_index: Number(h.stroke_index),
  }));
}

/**
 * @param {Array<{ hole_number: number, par: number|string, stroke_index: number|string }>} holes
 * @param {number|null|undefined} coursePar
 * @returns {string[]} validation error messages
 */
export function validateCourseHoles(holes, coursePar) {
  const errors = [];

  if (!holes?.length) {
    errors.push('Add all 18 holes before saving.');
    return errors;
  }

  const strokeIndexes = [];
  let parSum = 0;

  for (const h of holes) {
    const n = h.hole_number;

    if (h.par === '' || h.par == null || Number.isNaN(Number(h.par))) {
      errors.push(`Hole ${n}: enter a par.`);
      continue;
    }
    parSum += Number(h.par);

    if (h.stroke_index === '' || h.stroke_index == null || Number.isNaN(Number(h.stroke_index))) {
      errors.push(`Hole ${n}: enter a stroke index (SI).`);
      continue;
    }

    const si = Number(h.stroke_index);
    if (si < 1 || si > 18) {
      errors.push(`Hole ${n}: SI must be between 1 and 18.`);
    } else {
      strokeIndexes.push(si);
    }
  }

  if (strokeIndexes.length === holes.length) {
    const unique = new Set(strokeIndexes);
    if (unique.size !== holes.length) {
      errors.push('Each stroke index (1–18) must be used exactly once.');
    }
  }

  const expectedPar = coursePar != null && coursePar !== '' ? Number(coursePar) : null;
  if (expectedPar != null && !Number.isNaN(expectedPar) && parSum !== expectedPar) {
    errors.push(`Hole pars total ${parSum}; course par is ${expectedPar}. Adjust hole pars or update the course par.`);
  }

  return errors;
}
