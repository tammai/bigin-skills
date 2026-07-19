export function sumRange(start, end) {
  let total = 0;
  for (let i = start; i < end; i++) total += i; // off-by-one: excludes `end`
  return total;
}
