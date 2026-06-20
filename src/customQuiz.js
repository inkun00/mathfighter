const PADLET_META_REGEX = /<meta\s+(?:property="og:description"|name="description")\s+content="([^"]+)"/i;

function decodeHtmlEntities(str) {
  const txt = document.createElement("textarea");
  txt.innerHTML = str;
  return txt.value;
}

function fetchWithTimeout(url, options = {}, timeout = 3500) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  return fetch(url, { ...options, signal: controller.signal })
    .then(res => {
      clearTimeout(id);
      return res;
    })
    .catch(err => {
      clearTimeout(id);
      throw err;
    });
}

export function parsePadletText(text) {
  const parts = text.split('●');
  const categories = [];

  for (let i = 1; i < parts.length; i++) {
    const rawPart = parts[i].trim();
    if (!rawPart) continue;

    const items = rawPart.split(',').map(item => item.trim()).filter(Boolean);
    if (items.length < 2) continue;

    const catName = items[0];
    const catItems = items.slice(1);
    const lastIdx = catItems.length - 1;
    if (lastIdx >= 0) {
      catItems[lastIdx] = catItems[lastIdx].split(/🌱|🐾|🍄|🧫|🦠|🧬/)[0].trim();
    }

    const cleanItems = catItems.map(x => x.trim()).filter(Boolean);
    if (catName && cleanItems.length > 0) {
      categories.push({
        name: catName,
        items: cleanItems
      });
    }
  }

  console.log('[Parser] Parsed categories:', categories.map(c => `${c.name}(${c.items.length})`));
  return categories;
}

async function fetchPadletContents(url) {
  const attempts = [
    {
      label: 'Local API',
      url: `/api/fetch-padlet?url=${encodeURIComponent(url)}`,
      timeout: 15000
    },
    {
      label: 'allorigins raw',
      url: `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
      timeout: 8000
    },
    {
      label: 'corsproxy.io',
      url: `https://corsproxy.io/?${url}`,
      timeout: 8000
    },
    {
      label: 'codetabs',
      url: `https://api.codetabs.com/v1/proxy/?quest=${url}`,
      timeout: 8000
    }
  ];

  for (const attempt of attempts) {
    try {
      const response = await fetchWithTimeout(attempt.url, {}, attempt.timeout);
      if (response.ok) {
        console.log(`SUCCESS using Padlet proxy (${attempt.label})`);
        return response.text();
      }
    } catch (err) {
      console.warn(`Padlet proxy failed (${attempt.label}):`, err);
    }
  }

  throw new Error("네트워크 연결 오류 또는 모든 프록시 경로가 차단되었습니다. 잠시 후 다시 시도해 주세요.");
}

export async function loadCustomQuizFromPadletUrl(url) {
  if (!url) {
    throw new Error("게시물 주소를 입력해 주세요.");
  }

  if (!url.includes('padlet.com')) {
    throw new Error("올바른 패들릿 주소가 아닙니다.");
  }

  if (!url.includes('/wish/') && !url.includes('/posts/')) {
    throw new Error("입력하신 주소는 패들릿 보드 주소입니다. 보드 안의 퀴즈 게시물(Post)을 클릭하여 '게시물 열기'를 하신 후, 해당 개별 게시물 주소를 복사해 입력해 주세요.");
  }

  const contents = await fetchPadletContents(url);
  const match = contents.match(PADLET_META_REGEX);
  if (!match) {
    throw new Error("게시물에서 교과 퀴즈 텍스트를 찾을 수 없습니다.");
  }

  const decodedText = decodeHtmlEntities(match[1]);
  const categories = parsePadletText(decodedText);
  if (categories.length === 0) {
    throw new Error("분류 퀴즈 데이터를 파싱할 수 없습니다. 형식을 확인하세요.");
  }

  return categories;
}
