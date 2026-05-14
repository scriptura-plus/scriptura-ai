import "server-only";

import { callPearlClaude } from "./claude";
import type {
  PearlV3CardDraft,
  PearlV3ClaimType,
  PearlV3ScoreResult,
  PearlV3VerseContext,
  PearlV3WeaknessRoot,
} from "./types";

const SYSTEM = `Ты — строгий судья карточек-жемчужин по библейскому тексту. Твоя работа двойная: проверить, есть ли у карточки основание в тексте (включая греческий/еврейский оригинал, если он дан), и оценить силу её читательского сдвига.

ТЫ НЕ ПРОСТО СТАВИШЬ БАЛЛ.
Ты должен помочь отсортировать карточки от лучших к слабым. Поэтому используй всю шкалу, а не ставь всем хорошим карточкам 86-88.

КАЛИБРОВКА ШКАЛЫ

95-100: редкая жемчужина. Очень сильный, точный, неожиданный сдвиг; прочная текстовая/структурная/лексическая опора; литературная подача без overclaim. Такие оценки должны быть редкими.

90-94: настоящий сдвиг. Зрелый читатель скажет: «я этого не замечал». Основание прочное. Подача усиливает наблюдение, а не просто украшает его. Карточка может быть опубликована среди первых.

84-89: хорошая жемчужина. Угол реальный и полезный, но либо не редкий, либо уже встречается в комментариях, либо исполнение немного размывает находку. Это достойные карточки, но не вершина набора.

76-83: полезный материал, но не вау. Есть наблюдение, но оно вторичное, слишком знакомое, перегружено метафорой, недостаточно точно или больше похоже на хорошую заготовку для речи, чем на готовую жемчужину.

60-75: слабая карточка. Есть какая-то мысль, но она слишком общая, пересказывает стих, держится на слабом выводе или требует серьёзной переработки.

1-59: не годится. Перефраз стиха, мораль, красивая вода, выход за рамки текста, отсутствие textual_ground или противоречие проверенному оригинально-языковому пакету. Если textual_ground отсутствует, score не выше 49. Если оригинально-языковой пакет противоречит утверждению карточки, score не выше 40.

УСЛОВИЯ ДЛЯ 90+

Ставь 90+ только если одновременно верно:

1. Угол действительно неочевидный даже для зрелого читателя.
2. Есть конкретная опора в тексте, структуре, контексте или оригинально-языковом пакете.
3. Карточка не строит больше, чем позволяет текст.
4. Подача раскрывает наблюдение, а не просто звучит красиво.
5. После чтения остаётся ясный сдвиг: теперь стих видится иначе.

Не давай 90+ только за красивый стиль. Красивая карточка с обычной мыслью — это 76-89, в зависимости от силы.

ОСТОРОЖНОСТЬ С ОРИГИНАЛЬНЫМ ЯЗЫКОМ

Будь особенно строг к греческим/еврейским утверждениям.

Не превращай морфологию в слишком сильный вывод:
- Aorist обычно представляет действие как цельное событие, но не всегда означает «однократное действие» в простом смысле.
- Present часто имеет imperfective/ongoing aspect, но не всегда автоматически значит «постоянно продолжается».
- Лексический gloss не равен полному значению слова.

Если карточка делает точный лексический claim — оценивай высоко.
Если она строит красивый богословский вывод на тонкой грамматике — снижай оценку или укажи execution weakness.

ПОВТОРЫ И БЛИЗКИЕ УГЛЫ

Ты оцениваешь одну карточку, поэтому не обязан удалять близкие углы. Близкие варианты могут быть полезны исследователю.

Но если сама карточка выглядит как вариация очень известной мысли без нового акцента, не ставь высокий балл.

ДИАГНОЗ СЛАБОСТИ

Определи weakness_root:
- "angle" — слабость в самом угле. Угол банален, известен, не несёт сдвига или не держится на тексте.
- "execution" — угол хороший, но исполнение подвело: заголовок слабый, teaser пересказывает стих, опора неточная, тон проповеднический, вывод вялый, метафора перегружена.
- "none" — score 90+ и серьёзных претензий нет. Для 82-89 чаще всего всё равно есть небольшая weakness_detail.

ТИП УТВЕРЖДЕНИЯ claim_type:
- structural
- rhetorical
- narrative
- lexical
- intertextual
- theological

ФОРМАТ ОТВЕТА

Верни строго JSON, ничего до или после:

{
  "textual_ground": "<одна фраза о том, на чём держится карточка>",
  "score": <число 1-100>,
  "claim_type": "<structural | rhetorical | narrative | lexical | intertextual | theological>",
  "reasoning": "<2-4 строки, почему такая оценка>",
  "weakness_root": "<angle | execution | none>",
  "weakness_detail": "<2-3 строки конкретно что слабо, или пустая строка если none>"
}`;

function buildUserPrompt(args: {
  ctx: PearlV3VerseContext;
  card: PearlV3CardDraft;
  originalLanguageForScorer: string;
}): string {
  return `ВХОДНЫЕ ДАННЫЕ

Стих: ${args.ctx.centralRef}
«${args.ctx.centralText}»

Карточка:
Заголовок: ${args.card.title}
Опора: ${args.card.anchor}
Основной текст: ${args.card.teaser}
Почему это важно: ${args.card.why_it_matters}

Проверенные оригинально-языковые данные:
${args.originalLanguageForScorer}

ШАГ 1 — ПОИСК ОСНОВАНИЯ

Прежде чем оценивать силу, найди в самом стихе, ближайшем контексте или проверенном оригинально-языковом пакете конкретное основание для центрального утверждения карточки.

Возможные типы основания:
- Текстовое: конкретное слово или место в русском тексте.
- Структурное: порядок слов, грамматическая конструкция, видимая в русском.
- Риторическое: логическая связка, инверсия, усиление, контраст, warrant.
- Контекстуальное: связь с конкретным местом окружающей главы.
- Лексическое: слово, лемма, морфология или gloss из проверенного пакета.

Запиши основание в поле textual_ground одной фразой. Если основания нет — пиши «отсутствует».

ШАГ 2 — ОЦЕНКА СИЛЫ СДВИГА

Проверь:
1. Реальный ли это сдвиг или красивая вода?
2. Подтверждает ли текст или оригинально-языковой пакет утверждение карточки?
3. Не выходит ли карточка за пределы того, что реально поддержано?
4. Не повторяет ли она общее место?
5. Подача раскрывает угол или просто красиво перефразирует стих?

ШАГ 3 — ДИАГНОЗ СЛАБОСТИ

Определи weakness_root:
- "angle" — слабость в самом угле. Угол банален, известен, не несёт сдвига или не держится на тексте.
- "execution" — угол хороший, но исполнение подвело: заголовок слабый, teaser пересказывает стих, опора неточная, тон проповеднический, вывод вялый.
- "none" — score 90+ и серьёзных претензий нет. Для 82-89 чаще всего всё равно есть небольшая weakness_detail.

ТИП УТВЕРЖДЕНИЯ claim_type:
- structural
- rhetorical
- narrative
- lexical
- intertextual
- theological

ФОРМАТ ОТВЕТА

Верни строго JSON, ничего до или после:

{
  "textual_ground": "<одна фраза о том, на чём держится карточка>",
  "score": <число 1-100>,
  "claim_type": "<structural | rhetorical | narrative | lexical | intertextual | theological>",
  "reasoning": "<2-4 строки, почему такая оценка>",
  "weakness_root": "<angle | execution | none>",
  "weakness_detail": "<2-3 строки конкретно что слабо, или пустая строка если none>"
}`;
}

export async function runPearlV3Scorer(args: {
  ctx: PearlV3VerseContext;
  card: PearlV3CardDraft;
  originalLanguageForScorer: string;
}): Promise<{ rawOutput: string; result: PearlV3ScoreResult | null }> {
  const rawOutput = await callPearlClaude({
    system: SYSTEM,
    user: buildUserPrompt(args),
    maxTokens: 1800,
  });

  return {
    rawOutput,
    result: parseScoreJson(rawOutput),
  };
}

function parseScoreJson(raw: string): PearlV3ScoreResult | null {
  let cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const objectStart = cleaned.indexOf("{");
  const objectEnd = cleaned.lastIndexOf("}");

  if (objectStart !== -1 && objectEnd !== -1 && objectEnd > objectStart) {
    cleaned = cleaned.slice(objectStart, objectEnd + 1);
  }

  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    const score = Number(parsed.score);

    if (!Number.isFinite(score) || score < 1 || score > 100) {
      return null;
    }

    const rawWeakness = String(parsed.weakness_root ?? "none")
      .trim()
      .toLowerCase();

    const weaknessRoot: PearlV3WeaknessRoot =
      rawWeakness === "angle" || rawWeakness === "execution"
        ? rawWeakness
        : "none";

    return {
      textualGround: String(parsed.textual_ground ?? "").trim(),
      score,
      claimType: normalizeClaimType(parsed.claim_type),
      reasoning: String(parsed.reasoning ?? "").trim(),
      weaknessRoot,
      weaknessDetail: String(parsed.weakness_detail ?? "").trim(),
    };
  } catch {
    return null;
  }
}

function normalizeClaimType(value: unknown): PearlV3ClaimType {
  const raw = String(value ?? "").trim().toLowerCase();

  if (
    raw === "structural" ||
    raw === "rhetorical" ||
    raw === "narrative" ||
    raw === "lexical" ||
    raw === "intertextual" ||
    raw === "theological"
  ) {
    return raw;
  }

  return "theological";
}