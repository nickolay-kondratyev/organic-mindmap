/**
 * Wraps a pure function so it returns the previous result while every argument is the same object (`===`) as on
 * the previous call; any other call computes afresh. One slot only: the repaint path asks the same question
 * every frame, so remembering the last answer is what makes hover, pan, zoom and the busy animation cheap, and
 * identity is the only comparison that is both exact and free. Hosts replace data/config objects when they change.
 */
export function rememberLast<Args extends readonly unknown[], Result>(
  compute: (...args: Args) => Result,
): (...args: Args) => Result {
  let last: { readonly args: Args; readonly result: Result } | null = null;
  return (...args: Args): Result => {
    if (last !== null && sameArguments(last.args, args)) return last.result;
    const result = compute(...args);
    last = { args, result };
    return result;
  };
}

function sameArguments(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
