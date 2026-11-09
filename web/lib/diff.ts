export type Part = { t: "same" | "del" | "ins"; w: string };

/** Word-level diff (LCS). Deletions are struck through, insertions underlined, so it never relies on colour alone. */
export function wordDiff(a: string, b: string): Part[] {
  const x = a.split(/(\s+)/).filter(Boolean);
  const y = b.split(/(\s+)/).filter(Boolean);
  const n = x.length;
  const m = y.length;
  const L: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = x[i] === y[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out: Part[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) {
      out.push({ t: "same", w: x[i] });
      i++;
      j++;
    } else if (L[i + 1][j] >= L[i][j + 1]) {
      out.push({ t: "del", w: x[i++] });
    } else {
      out.push({ t: "ins", w: y[j++] });
    }
  }
  while (i < n) out.push({ t: "del", w: x[i++] });
  while (j < m) out.push({ t: "ins", w: y[j++] });
  return out;
}
