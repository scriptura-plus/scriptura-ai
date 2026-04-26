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

function getIdleLabel(lang: Lang): string {
  if (lang === "ru") return "Найти ещё жемчужины";
  if (lang === "es") return "Buscar más perlas";
  return "Find more pearls";
}

function getLoadingLabel(lang: Lang): string {
  if (lang === "ru") return "Ищем жемчужины...";
  if (lang === "es") return "Buscando perlas...";
  return "Finding pearls...";
}

function getFallbackError(lang: Lang): string {
  if (lang === "ru") {
    return "Не получилось найти новые жемчужины. Попробуйте позже.";
  }

  if (lang === "es") {
    return "No se pudieron encontrar nuevas perlas. Inténtalo de nuevo más tarde.";
  }

  return "Could not find new pearls. Please try again later.";
}

function getDoneMessage(lang: Lang): string {
  if (lang === "ru") return "Готово. Список жемчужин обновлён.";
  if (lang === "es") return "Listo. La lista de perlas se actualizó.";
  return "Done. The pearls list has been updated.";
}

function getNoExploreMessage(lang: Lang): string {
  if (lang === "ru") {
    return "Основные сильные жемчужины по этому стиху уже найдены.";
  }

  if (lang === "es") {
    return "Las principales perlas de este versículo ya fueron encontradas.";
  }

  return "The main strong pearls for this verse have already been found.";
}

export default function ExploreMorePearlsButton({
  reference,
  verseText,
  lang,
  provider = "openai",
  onCardsUpdated,
}: ExploreMorePearlsButtonProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleExploreMore() {
    if (loading) return;

    setLoading(true);
    setMessage(null);

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

      if (!response.ok || !data.ok) {
        setMessage(data.error ?? getFallbackError(lang));
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
        setMessage(data.decision?.message ?? getNoExploreMessage(lang));
        return;
      }

      setMessage(getDoneMessage(lang));
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : getFallbackError(lang),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="pearls-explore-box">
      <button
        type="button"
        className="pearls-explore-button"
        onClick={handleExploreMore}
        disabled={loading}
      >
        {loading ? getLoadingLabel(lang) : getIdleLabel(lang)}
      </button>

      {message ? <p className="pearls-explore-message">{message}</p> : null}
    </div>
  );
}
