"use client";

import type { CSSProperties } from "react";

type GroupStatus = "featured" | "reserve" | "hidden" | "rejected";

type StudioCardForGroupActions = {
  id: string;
  title: string;
  status: string;
};

type GroupUpdateResponse = {
  ok?: boolean;
  error?: string;
  changed_database?: boolean;
  mode?: "translation_group" | "single_card";
  card_id?: string;
  translation_group_id?: string | null;
  status?: GroupStatus;
  moderator_decision?: string;
  updated_count?: number;
  cards?: Array<{
    id: string;
    lang?: string;
    title?: string;
    status?: string;
    translation_group_id?: string | null;
  }>;
};

type Props = {
  card: StudioCardForGroupActions;
  adminSecret: string;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
  onUpdated?: (status: GroupStatus, message: string) => void;
  onError?: (message: string) => void;
};

const SLATE_DARK = "#5b6672";
const SLATE_SOFT_2 = "#f5f7f9";
const WARNING_BG = "#f5ebd5";
const WARNING_TEXT = "#8a6330";
const ERROR_BG = "#f5dfd7";
const ERROR_TEXT = "#8b3e2e";

function smallButtonStyle(disabled = false): CSSProperties {
  return {
    border: "1px solid rgba(111, 123, 136, 0.24)",
    borderRadius: 999,
    background: SLATE_SOFT_2,
    color: SLATE_DARK,
    padding: "8px 12px",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 13,
    fontWeight: 800,
    fontFamily: "inherit",
    opacity: disabled ? 0.62 : 1,
  };
}

function dangerButtonStyle(disabled = false): CSSProperties {
  return {
    border: "1px solid rgba(138, 99, 48, 0.28)",
    borderRadius: 999,
    background: disabled ? "#eee8de" : WARNING_BG,
    color: WARNING_TEXT,
    padding: "8px 12px",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 13,
    fontWeight: 800,
    fontFamily: "inherit",
    opacity: disabled ? 0.62 : 1,
  };
}

function getActionLabel(status: GroupStatus): string {
  if (status === "hidden") return "Скрыть мысль RU/EN/ES";
  if (status === "rejected") return "Отклонить мысль RU/EN/ES";
  if (status === "reserve") return "Вернуть в запас RU/EN/ES";
  return "Сделать активной RU/EN/ES";
}

function getDecision(status: GroupStatus): string {
  if (status === "hidden") return "group_hide_from_studio";
  if (status === "rejected") return "group_reject_from_studio";
  if (status === "reserve") return "group_restore_reserve_from_studio";
  return "group_force_featured_from_studio";
}

function getSuccessMessage(status: GroupStatus, count: number | undefined): string {
  const suffix = typeof count === "number" ? ` Обновлено карточек: ${count}.` : "";

  if (status === "hidden") {
    return `Мысль скрыта во всех языках.${suffix}`;
  }

  if (status === "rejected") {
    return `Мысль отклонена во всех языках.${suffix}`;
  }

  if (status === "reserve") {
    return `Мысль возвращена в запас во всех языках.${suffix}`;
  }

  return `Мысль сделана активной во всех языках.${suffix}`;
}

export function GroupCardActions({
  card,
  adminSecret,
  disabled = false,
  onBusyChange,
  onUpdated,
  onError,
}: Props) {
  async function updateGroup(status: GroupStatus) {
    if (!adminSecret.trim()) {
      onError?.("Вставь Admin Secret.");
      return;
    }

    if (
      status === "rejected" &&
      !window.confirm(
        "Отклонить эту мысль во всех языках RU/EN/ES? Это уберёт всю группу из рабочей выдачи.",
      )
    ) {
      return;
    }

    if (
      status === "hidden" &&
      !window.confirm(
        "Скрыть эту мысль во всех языках RU/EN/ES? Её можно будет вернуть позже.",
      )
    ) {
      return;
    }

    onBusyChange?.(true);

    try {
      const response = await fetch("/api/admin/studio/update-angle-card-group", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret,
        },
        body: JSON.stringify({
          card_id: card.id,
          status,
          moderator_decision: getDecision(status),
        }),
      });

      const data = (await response.json()) as GroupUpdateResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Не удалось обновить группу карточек.");
      }

      onUpdated?.(status, getSuccessMessage(status, data.updated_count));
    } catch (error) {
      onError?.(
        error instanceof Error
          ? error.message
          : "Не удалось обновить группу карточек.",
      );
    } finally {
      onBusyChange?.(false);
    }
  }

  const busy = disabled;

  return (
    <div
      style={{
        marginTop: 12,
        padding: 12,
        borderRadius: 14,
        background: "#fffdfa",
        border: "1px solid #d9d0c2",
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 900,
          color: SLATE_DARK,
          marginBottom: 8,
        }}
      >
        Управление мыслью RU/EN/ES
      </div>

      <p
        style={{
          margin: "0 0 10px",
          color: "#6d645b",
          fontSize: 13,
          lineHeight: 1.55,
        }}
      >
        Эти кнопки работают не с одной языковой карточкой, а со всей связанной мыслью:
        русская, английская и испанская версии обновляются вместе.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {card.status !== "reserve" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => updateGroup("reserve")}
            style={smallButtonStyle(busy)}
          >
            {getActionLabel("reserve")}
          </button>
        ) : null}

        {card.status !== "hidden" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => updateGroup("hidden")}
            style={dangerButtonStyle(busy)}
          >
            {getActionLabel("hidden")}
          </button>
        ) : null}

        {card.status !== "rejected" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => updateGroup("rejected")}
            style={{
              ...dangerButtonStyle(busy),
              background: busy ? "#eee8de" : ERROR_BG,
              color: ERROR_TEXT,
              border: "1px solid rgba(139, 62, 46, 0.22)",
            }}
          >
            {getActionLabel("rejected")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
