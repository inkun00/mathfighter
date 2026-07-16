export function extractWholeNumberAnswer(value) {
  const normalized = String(value ?? '').trim().replace(/,/g, '');
  const match = normalized.match(/^(\d+)\s*(만|억|조)?(?:[^\d.,+\-]*)$/);
  if (!match) return null;

  const unitMultiplier = {
    '만': 10_000n,
    '억': 100_000_000n,
    '조': 1_000_000_000_000n
  };
  const multiplier = unitMultiplier[match[2]] || 1n;
  return (BigInt(match[1]) * multiplier).toString();
}

export function isDigitsOnlyAnswer(value) {
  return /^\d+$/.test(String(value));
}
