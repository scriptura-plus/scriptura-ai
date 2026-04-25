"use client";

import { useState } from "react";

type Lang = "ru" | "en" | "es";

type PearlCard = {
  id: string;
  title: string;
  anchor?: string | null;
  teaser: string;
  why_it_matters?: string | null;
  score_total?: number | null;
  status?: string | null;
  coverage_type?: string | null;
};

type ExploreMoreResponse = {
  ok?: boolean;
  explored?: boolean;
  result_message?: string;
  added_count?: number;
  added_featured_count?: number;
  added_reserve_count?: number;
  decision?: {
    set_maturity?: string;
    public_label?: string;
    message?: string;
  };
  after?: {
    count?: number;
    featured_count?: number;
    reserve_count?: number;
    cards?: PearlCard[];
  };
  error?: string;
};

type ExploreMorePearlsButtonProps = {
  reference: string;
  verseText: string;
  lang: Lang;
  provider?: string;
  onCardsUpdated?: (cards: PearlCard[]) => void;
};

export default function ExploreMorePearlsButton({
  reference,
  verseText,
  lang,
  provider = "openai",
  onCardsUpdated,
}: ExploreMorePearlsButtonProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ExploreMoreResponse | null>(
    null,
  );

  async function handleExploreMore() {
    if (loading) return;

    setLoading(true);
    setMessage(null);
    setLastResult(null);

    try {
      const response = await fetch("/api/angles/explore-more", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reference,
          verseText,
          lang,
          provider,
        }),
      });

      const data = (await response.json()) as ExploreMoreResponse;

      setLastResult(data);

      if (!response.ok || !data.ok) {
        setMessage(
          data.error ??
            "Не получилось найти новые жемчужины. Попробуйте позже.",
        );
        return;
      }

      if (data.after?.cards && onCardsUpdated) {
        onCardsUpdated(data.after.cards);
      }

      if (data.result_message) {
        setMessage(data.result_message);
        return;
      }

      if (data.explored === false) {
        setMessage(
          data.decision?.message ??
            "Основные сильные жемчужины по этому стиху уже найдены.",
        );
        return;
      }

      setMessage("Готово. Список жемчужин обновлён.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Не получилось найти новые жемчужины.",
      );
    } finally {
      setLoading(false);
    }
  }

  const addedCount = lastResult?.added_count ?? 0;
  const maturity = lastResult?.decision?.set_maturity;

  return (
    <div className="pearls-explore-box">
      <button
        type="button"
        className="pearls-explore-button"
        onClick={handleExploreMore}
        disabled={loading}
      >
        {loading ? "Ищем жемчужины..." : "Найти ещё жемчужины"}
      </button>

      {message ? <p className="pearls-explore-message">{message}</p> : null}

      {lastResult?.ok ? (
        <p className="pearls-explore-meta">
          {maturity ? `Зрелость набора: ${maturity}. ` : ""}
          {lastResult.explored
            ? addedCount > 0
              ? `Добавлено: ${addedCount}.`
              : "Новых сильных карточек не добавлено."
            : "Поиск остановлен без лишней генерации."}
        </p>
      ) : null}
    </div>
  );
}
