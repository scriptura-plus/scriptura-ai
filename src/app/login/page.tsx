"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const text = {
  eyebrow: "Scriptura AI",
  title: "\u0417\u0430\u043a\u0440\u044b\u0442\u044b\u0439 \u0431\u0435\u0442\u0430-\u0434\u043e\u0441\u0442\u0443\u043f",
  subtitle: "\u0412\u043e\u0439\u0434\u0438\u0442\u0435 \u0441 \u043f\u0440\u0438\u0433\u043b\u0430\u0448\u0451\u043d\u043d\u043e\u0439 \u043f\u043e\u0447\u0442\u044b, \u0447\u0442\u043e\u0431\u044b \u043e\u0442\u043a\u0440\u044b\u0442\u044c Scriptura AI.",
  emailLabel: "Email",
  button: "\u0412\u043e\u0439\u0442\u0438 \u043f\u043e \u0441\u0441\u044b\u043b\u043a\u0435",
  sending: "\u041e\u0442\u043f\u0440\u0430\u0432\u043b\u044f\u0435\u043c...",
  checkEmail: "\u041f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435 \u043f\u043e\u0447\u0442\u0443. \u041c\u044b \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u043b\u0438 \u0441\u0441\u044b\u043b\u043a\u0443 \u0434\u043b\u044f \u0432\u0445\u043e\u0434\u0430.",
  betaOnly: "\u0414\u043e\u0441\u0442\u0443\u043f \u0441\u0435\u0439\u0447\u0430\u0441 \u043e\u0442\u043a\u0440\u044b\u0442 \u0442\u043e\u043b\u044c\u043a\u043e \u0434\u043b\u044f \u043f\u0440\u0438\u0433\u043b\u0430\u0448\u0451\u043d\u043d\u044b\u0445 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0435\u0439.",
  notConfigured: "\u0412\u0445\u043e\u0434 \u043f\u043e\u043a\u0430 \u043d\u0435 \u043d\u0430\u0441\u0442\u0440\u043e\u0435\u043d: \u043d\u0435\u0442 Supabase env.",
  genericError: "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u0441\u0441\u044b\u043b\u043a\u0443. \u041f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435 email \u0438 \u043f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u0435\u0449\u0451 \u0440\u0430\u0437.",
  callbackError: "\u0412\u0445\u043e\u0434 \u043d\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u043b\u0441\u044f. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u0435\u0449\u0451 \u0440\u0430\u0437.",
};

function getSafeNext(value: string | null) {
  if (value && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }

  return "/study";
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [nextPath, setNextPath] = useState("/study");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNextPath(getSafeNext(params.get("next")));

    if (params.get("error")) {
      setError(text.callbackError);
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      setError(text.notConfigured);
      setLoading(false);
      return;
    }

    const cleanEmail = email.trim();
    const emailRedirectTo =
      window.location.origin +
      "/auth/callback?next=" +
      encodeURIComponent(nextPath);

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        emailRedirectTo,
        shouldCreateUser: false,
      },
    });

    if (signInError) {
      setError(signInError.message || text.genericError);
    } else {
      setMessage(text.checkEmail);
    }

    setLoading(false);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#f7efe2",
        color: "#2b241b",
        fontFamily:
          "ui-serif, Georgia, Cambria, Times New Roman, Times, serif",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 520,
          padding: 28,
          borderRadius: 28,
          border: "1px solid rgba(109, 82, 51, 0.16)",
          background: "rgba(255, 252, 246, 0.94)",
          boxShadow: "0 18px 50px rgba(92, 66, 36, 0.10)",
        }}
      >
        <p
          style={{
            margin: "0 0 8px",
            color: "#7e6143",
            fontSize: 13,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {text.eyebrow}
        </p>
        <h1 style={{ margin: 0, fontSize: 38, lineHeight: 1.05 }}>
          {text.title}
        </h1>
        <p style={{ color: "#66533e", fontSize: 17, lineHeight: 1.5 }}>
          {text.subtitle}
        </p>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
          <label
            style={{
              display: "grid",
              gap: 7,
              color: "#6f5b45",
              fontSize: 14,
            }}
          >
            {text.emailLabel}
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
              style={{
                border: "1px solid rgba(93, 70, 44, 0.22)",
                background: "#fffaf1",
                borderRadius: 14,
                padding: "13px 14px",
                color: "#2b241b",
                fontSize: 16,
                outline: "none",
              }}
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            style={{
              border: "none",
              borderRadius: 14,
              padding: "13px 18px",
              background: loading ? "#8aa1b4" : "#496f8f",
              color: "white",
              fontWeight: 700,
              cursor: loading ? "default" : "pointer",
            }}
          >
            {loading ? text.sending : text.button}
          </button>
        </form>

        {message ? (
          <p style={{ color: "#315f3d", marginTop: 16 }}>{message}</p>
        ) : null}
        {error ? (
          <p style={{ color: "#8a342e", marginTop: 16 }}>{error}</p>
        ) : null}

        <p style={{ color: "#7b6750", fontSize: 14, lineHeight: 1.5 }}>
          {text.betaOnly}
        </p>
      </section>
    </main>
  );
}
