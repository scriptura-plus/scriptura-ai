"use client";

import { useEffect, useMemo, useState } from "react";

const BASE_REQUEST = {
  reference: "Ефесянам 4:32",
  verseText:
    "А вы будьте добры друг к другу, сострадательны, великодушно прощайте друг друга, как и Бог через Христа великодушно простил вас.",
  lang: "ru",
  provider: "openai",
  targetFeaturedCount: 12,
  sourceArticle: "",
};

const DUPLICATE_ANGLE_REQUEST = {
  ...BASE_REQUEST,
  candidate: {
    id: "candidate_duplicate_angle",
    title: "Прощение здесь не бухгалтерия, а подарочная грамматика",
    anchor: "«великодушно прощайте»",
    teaser:
      "Павел выбирает не просто язык списания долга, а глагол из поля дара и благосклонности. Поэтому прощение звучит не как закрытие счёта, а как действие, которое повторяет логику незаслуженного подарка.",
    why_it_matters:
      "Так стих переносит центр тяжести с юридической отмены долга на щедрость, которую человек сам уже получил.",
  },
};

const CHRIST_ANGLE_REQUEST = {
  ...BASE_REQUEST,
  candidate: {
    id: "candidate_christ_angle",
    title: "«Во Христе» звучит как место, а не как инструмент",
    anchor: "«как и Бог через Христа простил вас»",
    teaser:
      "Фраза не просто говорит, что Бог простил через Христа как через средство. Она помещает Божий акт прощения внутрь определённой сферы: прощение имеет пространство, в котором оно стало возможным и образцовым.",
    why_it_matters:
      "Так сравнение работает не как голый пример для копирования, а как указание на уже заданную реальность, внутри которой люди обращаются друг с другом.",
  },
};

const SEQUENCE_ANGLE_REQUEST = {
  ...BASE_REQUEST,
  candidate: {
    id: "candidate_sequence_angle",
    title: "Павел ведёт от атмосферы к действию",
    anchor: "«будьте добры… сострадательны… прощайте»",
    teaser:
      "Три выражения стоят не как случайный список добродетелей. Сначала Павел задаёт общий тон отношения — доброту, затем внутреннюю реакцию — сострадание, и только потом конкретное трудное действие — прощение. Прощение в конце выглядит не отдельным приказом, а плодом уже созданной внутренней атмосферы.",
    why_it_matters:
      "Так стих читается не как три независимых требования, а как движение от характера к поступку: прощение становится возможным там, где человек уже учится видеть другого через доброту и сострадание.",
  },
};

const WEAK_GENERIC_REQUEST = {
  ...BASE_REQUEST,
  candidate: {
    id: "candidate_weak_generic",
    title: "Нужно быть добрыми и прощать других",
    anchor: "«будьте добры»",
    teaser:
      "Этот стих показывает, что христиане должны быть добрыми, сострадательными и прощать других людей.",
    why_it_matters:
      "Это важно, потому что доброта и прощение помогают сохранять мирные отношения.",
  },
};

const SAMPLE_ARTICLE =
  "В этой статье рассматривается, что Павел не просто перечисляет добродетели, а показывает смену внутренней среды общины. В предыдущем стихе он говорит об удалении раздражения, ярости, крика, злоречия и злобы. Поэтому фраза «А вы будьте добры» звучит как контрастный поворот: освободившееся место после удалённой враждебности должно быть заполнено другим способом обращения с людьми.\n\nОсобенно важно, что доброта здесь не остаётся мягким настроением. Она раскрывается через сострадание и прощение. Прощение становится практической проверкой того, действительно ли община стала другой внутренне.";

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

type ProcessRequest = typeof DUPLICATE_ANGLE_REQUEST;

export default function EvaluatorTestPage() {
  const [adminSecret, setAdminSecret] = useState("");
  const [requestText, setRequestText] = useState(
    formatJson(SEQUENCE_ANGLE_REQUEST),
  );

  const [articleText, setArticleText] = useState(SAMPLE_ARTICLE);
  const [articleTitle, setArticleTitle] = useState("Тестовая статья линзы");
  const [articleLens, setArticleLens] = useState("manual_article");

  const [processText, setProcessText] = useState("");
  const [cachedProcessText, setCachedProcessText] = useState("");
  const [generateText, setGenerateText] = useState("");
  const [extractText, setExtractText] = useState("");
  const [readText, setReadText] = useState("");

  const [processing, setProcessing] = useState(false);
  const [processingCached, setProcessingCached] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [reading, setReading] = useState(false);

  const parsedRequest = useMemo(() => {
    try {
      return JSON.parse(requestText) as ProcessRequest;
    } catch {
      return null;
    }
  }, [requestText]);

  useEffect(() => {
    const saved = window.localStorage.getItem("scriptura_admin_secret");
    if (saved) setAdminSecret(saved);
  }, []);

  function saveSecret(value: string) {
    setAdminSecret(value);
    window.localStorage.setItem("scriptura_admin_secret", value);
  }

  function loadPreset(value: unknown) {
    setRequestText(formatJson(value));
    setProcessText("");
    setCachedProcessText("");
    setGenerateText("");
    setExtractText("");
    setReadText("");
  }

  async function runProcessCandidate() {
    if (!parsedRequest) {
      setProcessText("JSON запроса повреждён.");
      return;
    }

    setProcessing(true);
    setProcessText("");

    try {
      const response = await fetch("/api/admin/process-angle-candidate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret,
        },
        body: JSON.stringify({
          reference: parsedRequest.reference,
          verseText: parsedRequest.verseText,
          lang: parsedRequest.lang,
          provider: parsedRequest.provider,
          source_provider: parsedRequest.provider,
          source_model: "manual_test",
          candidate: parsedRequest.candidate,
          sourceArticle: parsedRequest.sourceArticle ?? "",
          targetFeaturedCount: parsedRequest.targetFeaturedCount ?? 12,
        }),
      });

      const data = await response.json();

      setProcessText(
        formatJson({
          status: response.status,
          ok: response.ok,
          data,
        }),
      );
    } catch (error) {
      setProcessText(
        error instanceof Error ? error.message : "Process request failed.",
      );
    } finally {
      setProcessing(false);
    }
  }

  async function runProcessCachedAngles() {
    if (!parsedRequest) {
      setCachedProcessText("JSON запроса повреждён.");
      return;
    }

    setProcessingCached(true);
    setCachedProcessText("");

    try {
      const response = await fetch("/api/admin/process-cached-angles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret,
        },
        body: JSON.stringify({
          reference: parsedRequest.reference,
          verseText: parsedRequest.verseText,
          lang: parsedRequest.lang,
          provider: parsedRequest.provider,
          limit: 3,
        }),
      });

      const data = await response.json();

      setCachedProcessText(
        formatJson({
          status: response.status,
          ok: response.ok,
          data,
        }),
      );
    } catch (error) {
      setCachedProcessText(
        error instanceof Error
          ? error.message
          : "Process cached angles request failed.",
      );
    } finally {
      setProcessingCached(false);
    }
  }

  async function runGenerateAngleCandidates() {
    if (!parsedRequest) {
      setGenerateText("JSON запроса повреждён.");
      return;
    }

    setGenerating(true);
    setGenerateText("");

    try {
      const response = await fetch("/api/admin/generate-angle-candidates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret,
        },
        body: JSON.stringify({
          reference: parsedRequest.reference,
          verseText: parsedRequest.verseText,
          lang: parsedRequest.lang,
          provider: parsedRequest.provider,
          count: 6,
          processLimit: 3,
        }),
      });

      const data = await response.json();

      setGenerateText(
        formatJson({
          status: response.status,
          ok: response.ok,
          data,
        }),
      );
    } catch (error) {
      setGenerateText(
        error instanceof Error
          ? error.message
          : "Generate candidates request failed.",
      );
    } finally {
      setGenerating(false);
    }
  }

  async function runExtractFromArticle() {
    setExtractText("Кнопка нажата. Проверяю данные...");

    if (!adminSecret.trim()) {
      setExtractText("Ошибка: ADMIN_SECRET пустой.");
      return;
    }

    if (!parsedRequest) {
      setExtractText("Ошибка: JSON запроса повреждён.");
      return;
    }

    if (!articleText.trim()) {
      setExtractText("Ошибка: вставь текст статьи.");
      return;
    }

    setExtracting(true);
    setExtractText(
      "Отправляю статью в extractor. Ждём ответ GPT-5.5...\n\nЭто может занять 1–3 минуты.",
    );

    try {
      const payload = {
        reference: parsedRequest.reference,
        verseText: parsedRequest.verseText,
        lang: parsedRequest.lang,
        provider: parsedRequest.provider,
        sourceTitle: articleTitle || "Статья линзы",
        sourceType: "lens_article",
        sourceLens: articleLens || "manual_article",
        sourceArticle: articleText,
        count: 3,
        processLimit: 3,
      };

      const response = await fetch(
        "/api/admin/extract-angle-candidates-from-article",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-secret": adminSecret,
          },
          body: JSON.stringify(payload),
        },
      );

      let data: unknown = null;

      try {
        data = await response.json();
      } catch {
        data = {
          error: "Response was not valid JSON.",
        };
      }

      setExtractText(
        formatJson({
          diagnostic: "Extractor request finished.",
          status: response.status,
          ok: response.ok,
          sent: {
            reference: payload.reference,
            lang: payload.lang,
            provider: payload.provider,
            sourceTitle: payload.sourceTitle,
            sourceLens: payload.sourceLens,
            sourceArticleLength: payload.sourceArticle.length,
          },
          data,
        }),
      );
    } catch (error) {
      setExtractText(
        formatJson({
          diagnostic: "Extractor request failed before receiving response.",
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    } finally {
      setExtracting(false);
    }
  }

  async function runReadSavedCards() {
    if (!parsedRequest) {
      setReadText("JSON запроса повреждён.");
      return;
    }

    setReading(true);
    setReadText("");

    try {
      const params = new URLSearchParams({
        reference: parsedRequest.reference,
        lang: parsedRequest.lang,
        statuses: "featured,reserve",
        limit: "50",
      });

      const response = await fetch(`/api/admin/angle-cards?${params}`, {
        method: "GET",
        headers: {
          "x-admin-secret": adminSecret,
        },
      });

      const data = await response.json();

      setReadText(
        formatJson({
          status: response.status,
          ok: response.ok,
          data,
        }),
      );
    } catch (error) {
      setReadText(
        error instanceof Error ? error.message : "Read request failed.",
      );
    } finally {
      setReading(false);
    }
  }

  const presetButtonStyle = {
    border: "1px solid rgba(80, 58, 32, 0.18)",
    borderRadius: 999,
    background: "#e8dcc5",
    padding: "10px 14px",
    color: "#3b3021",
    cursor: "pointer",
    fontWeight: 600,
  } as const;

  const primaryButtonStyle = {
    border: "none",
    borderRadius: 999,
    background: "#5f7890",
    color: "#fff",
    padding: "12px 18px",
    cursor: "pointer",
    fontSize: 15,
    fontWeight: 600,
  } as const;

  const disabledButtonStyle = {
    ...primaryButtonStyle,
    background: "#c7bda9",
    cursor: "not-allowed",
  } as const;

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "32px 18px",
        background: "#f6efe1",
        color: "#2c2418",
        fontFamily:
          'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
      }}
    >
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <h1 style={{ fontSize: 32, marginBottom: 8 }}>
          Scriptura AI — автоцикл жемчужин
        </h1>

        <p style={{ marginBottom: 24, color: "#6f604a", lineHeight: 1.5 }}>
          Эта страница тестирует редакционный pipeline: кандидат → оценка GPT-5.5
          → перепись при необходимости → повторная оценка → battle с
          существующими карточками → сохранение в Supabase. Можно обработать
          старый кэш, сгенерировать новых кандидатов или извлечь жемчужины из
          статьи линзы.
        </p>

        <section style={sectionStyle}>
          <label style={labelStyle}>Admin Secret</label>

          <input
            value={adminSecret}
            onChange={(event) => saveSecret(event.target.value)}
            placeholder="Вставь ADMIN_SECRET"
            type="password"
            style={inputStyle}
          />
        </section>

        <section style={sectionStyle}>
          <h2 style={{ fontSize: 18, marginTop: 0, marginBottom: 12 }}>
            Готовые тесты
          </h2>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <button
              type="button"
              onClick={() => loadPreset(SEQUENCE_ANGLE_REQUEST)}
              style={presetButtonStyle}
            >
              Тест: новый угол — цепочка стиха
            </button>

            <button
              type="button"
              onClick={() => loadPreset(CHRIST_ANGLE_REQUEST)}
              style={presetButtonStyle}
            >
              Тест: угол «во Христе»
            </button>

            <button
              type="button"
              onClick={() => loadPreset(DUPLICATE_ANGLE_REQUEST)}
              style={presetButtonStyle}
            >
              Тест: дубль угла
            </button>

            <button
              type="button"
              onClick={() => loadPreset(WEAK_GENERIC_REQUEST)}
              style={presetButtonStyle}
            >
              Тест: слабая карточка
            </button>
          </div>
        </section>

        <section style={sectionStyle}>
          <h2 style={{ fontSize: 18, marginTop: 0 }}>Request JSON</h2>

          <textarea
            value={requestText}
            onChange={(event) => setRequestText(event.target.value)}
            spellCheck={false}
            style={{
              ...textareaStyle,
              minHeight: 420,
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
              fontSize: 13,
            }}
          />

          {!parsedRequest ? (
            <p style={{ color: "#9b3b2f", marginTop: 10 }}>
              JSON запроса повреждён.
            </p>
          ) : null}

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              marginTop: 14,
            }}
          >
            <button
              type="button"
              disabled={processing || !adminSecret || !parsedRequest}
              onClick={runProcessCandidate}
              style={
                processing || !adminSecret || !parsedRequest
                  ? disabledButtonStyle
                  : { ...primaryButtonStyle, background: "#7b5f8f" }
              }
            >
              {processing
                ? "Обрабатываем..."
                : "Автоцикл: оценить → исправить → сохранить"}
            </button>

            <button
              type="button"
              disabled={processingCached || !adminSecret || !parsedRequest}
              onClick={runProcessCachedAngles}
              style={
                processingCached || !adminSecret || !parsedRequest
                  ? disabledButtonStyle
                  : { ...primaryButtonStyle, background: "#8a6a3f" }
              }
            >
              {processingCached
                ? "Обрабатываем кэш..."
                : "Обработать старый кэш: первые 3"}
            </button>

            <button
              type="button"
              disabled={generating || !adminSecret || !parsedRequest}
              onClick={runGenerateAngleCandidates}
              style={
                generating || !adminSecret || !parsedRequest
                  ? disabledButtonStyle
                  : { ...primaryButtonStyle, background: "#2f7a62" }
              }
            >
              {generating
                ? "Генерируем..."
                : "Сгенерировать новые кандидаты: первые 3"}
            </button>

            <button
              type="button"
              disabled={reading || !adminSecret || !parsedRequest}
              onClick={runReadSavedCards}
              style={
                reading || !adminSecret || !parsedRequest
                  ? disabledButtonStyle
                  : primaryButtonStyle
              }
            >
              {reading ? "Читаем..." : "Прочитать сохранённые"}
            </button>
          </div>
        </section>

        <section style={sectionStyle}>
          <h2 style={{ fontSize: 18, marginTop: 0, marginBottom: 8 }}>
            Извлечь жемчужины из статьи
          </h2>

          <p style={{ color: "#6f604a", lineHeight: 1.5, marginTop: 0 }}>
            Вставь сюда статью из линзы или глубокий материал. Extractor
            попробует добыть из неё 1–3 candidate-жемчужины, а затем каждая
            пройдёт обычный evaluator/rewrite/battle.
          </p>

          <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
            <input
              value={articleTitle}
              onChange={(event) => setArticleTitle(event.target.value)}
              placeholder="Название статьи"
              style={inputStyle}
            />

            <input
              value={articleLens}
              onChange={(event) => setArticleLens(event.target.value)}
              placeholder="sourceLens: word / context / translation / deep_analysis / unfold"
              style={inputStyle}
            />
          </div>

          <textarea
            value={articleText}
            onChange={(event) => setArticleText(event.target.value)}
            spellCheck={false}
            style={{
              ...textareaStyle,
              minHeight: 260,
              fontFamily:
                'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
              fontSize: 15,
            }}
          />

          <div style={{ marginTop: 14 }}>
            <button
              type="button"
              disabled={
                extracting ||
                !adminSecret ||
                !parsedRequest ||
                !articleText.trim()
              }
              onClick={runExtractFromArticle}
              style={
                extracting ||
                !adminSecret ||
                !parsedRequest ||
                !articleText.trim()
                  ? disabledButtonStyle
                  : { ...primaryButtonStyle, background: "#9a5b35" }
              }
            >
              {extracting
                ? "Извлекаем жемчужины..."
                : "Извлечь жемчужины из статьи"}
            </button>
          </div>
        </section>

        <ResultBlock title="Результат автоцикла" text={processText} />

        <ResultBlock
          title="Результат обработки старого кэша"
          text={cachedProcessText}
        />

        <ResultBlock
          title="Результат генерации новых кандидатов"
          text={generateText}
        />

        <ResultBlock
          title="Результат извлечения из статьи"
          text={extractText}
        />

        <ResultBlock title="Сохранённые карточки" text={readText} />
      </div>
    </main>
  );
}

const sectionStyle = {
  border: "1px solid rgba(80, 58, 32, 0.18)",
  borderRadius: 18,
  padding: 18,
  background: "rgba(255, 252, 245, 0.72)",
  marginBottom: 18,
} as const;

const labelStyle = {
  display: "block",
  fontSize: 13,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#7a6a53",
  marginBottom: 8,
} as const;

const inputStyle = {
  width: "100%",
  border: "1px solid rgba(80, 58, 32, 0.22)",
  borderRadius: 12,
  padding: "12px 14px",
  background: "#fffaf0",
  color: "#2c2418",
  fontSize: 15,
  boxSizing: "border-box",
} as const;

const textareaStyle = {
  width: "100%",
  border: "1px solid rgba(80, 58, 32, 0.18)",
  borderRadius: 14,
  padding: 14,
  background: "#fffaf0",
  color: "#2c2418",
  lineHeight: 1.55,
  boxSizing: "border-box",
} as const;

function ResultBlock({ title, text }: { title: string; text: string }) {
  return (
    <div style={sectionStyle}>
      <h2 style={{ fontSize: 18, marginTop: 0, marginBottom: 10 }}>{title}</h2>

      <pre
        style={{
          minHeight: 220,
          whiteSpace: "pre-wrap",
          overflowX: "auto",
          border: "1px solid rgba(80, 58, 32, 0.18)",
          borderRadius: 14,
          padding: 14,
          background: "#fffaf0",
          color: "#2c2418",
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
          fontSize: 13,
          lineHeight: 1.45,
        }}
      >
        {text || "Пока нет результата."}
      </pre>
    </div>
  );
}
