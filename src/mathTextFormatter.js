const FRACTION_PATTERN = /(?:(\d+)\s+)?(\d+)\/(\d+)/g;

export function parseMathTextSegments(text) {
  const source = String(text ?? '');
  const segments = [];
  let cursor = 0;

  for (const match of source.matchAll(FRACTION_PATTERN)) {
    if (match.index > cursor) {
      segments.push({ type: 'text', value: source.slice(cursor, match.index) });
    }
    segments.push({
      type: 'fraction',
      whole: match[1] || '',
      numerator: match[2],
      denominator: match[3]
    });
    cursor = match.index + match[0].length;
  }

  if (cursor < source.length || segments.length === 0) {
    segments.push({ type: 'text', value: source.slice(cursor) });
  }
  return segments;
}

export function renderMathText(element, text) {
  const fragment = document.createDocumentFragment();

  parseMathTextSegments(text).forEach(segment => {
    if (segment.type === 'text') {
      fragment.append(document.createTextNode(segment.value));
      return;
    }

    const number = document.createElement('span');
    number.className = segment.whole ? 'math-mixed-number' : 'math-number';
    if (segment.whole) {
      const whole = document.createElement('span');
      whole.className = 'math-whole';
      whole.textContent = segment.whole;
      number.append(whole);
    }

    const fraction = document.createElement('span');
    fraction.className = 'math-fraction';
    fraction.setAttribute('role', 'img');
    fraction.setAttribute('aria-label', `${segment.denominator}분의 ${segment.numerator}`);

    const numerator = document.createElement('span');
    numerator.className = 'math-numerator';
    numerator.setAttribute('aria-hidden', 'true');
    numerator.textContent = segment.numerator;

    const denominator = document.createElement('span');
    denominator.className = 'math-denominator';
    denominator.setAttribute('aria-hidden', 'true');
    denominator.textContent = segment.denominator;

    fraction.append(numerator, denominator);
    number.append(fraction);
    fragment.append(number);
  });

  element.replaceChildren(fragment);
}
