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

КАЛИБРОВКА ШКАЛЫ

90-100: настоящий сдвиг. Зрелый читатель скажет «я этого не замечал». Основание прочное: текстовое, структурное, контекстуальное или лексическое. Подача литературная, но не туманная.

82-89: достойная жемчужина. Сдвиг есть, основание есть, но либо угол не редкий, либо подача не максимальная.

70-81: интересно, но не вау. Качественное наблюдение, но зрелый читатель скорее кивнёт, чем остановится.

50-69: общее место, пересказ, слабое основание или слишком известное наблюдение.

1-49: слабо. Перефраз стиха, мораль, красивая вода, выход за рамки текста или отсутствие textual_ground. Если textual_ground отсутствует, score не выше 49. Если оригинально-языковой пакет противоречит утверждению карточки, score не выше 40.

Ставь высокую оценку, если карточка реально сильная. Не бойся 90+, но не давай 90+ за красивую общую мысль.`;

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
- "none" — score 82+ и серьёзных претензий нет.

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
