"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, LoaderCircle, Sparkles } from "lucide-react";

type Answer = {
  answer: string;
  detail: string;
  scope: string;
  citations: Array<{
    id: string;
    type: string;
    label: string;
    detail: string;
    amount?: number;
  }>;
};

const examples = [
  "How much did I spend on potatoes this year?",
  "How much did I spend on Thai dining?",
  "How much have I deposited into Robinhood?",
  "What is my current net worth?",
];

const money = (value: number) =>
  value.toLocaleString("en-US", { style: "currency", currency: "USD" });

export function FinanceAskCard() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask(event?: FormEvent, example?: string) {
    event?.preventDefault();
    const nextQuestion = (example ?? question).trim();
    if (nextQuestion.length < 3 || loading) return;
    setQuestion(nextQuestion);
    setLoading(true);
    setError("");
    setAnswer(null);
    try {
      const response = await fetch("/api/finance/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: nextQuestion }),
      });
      const body = (await response.json()) as Answer & { error?: string };
      if (!response.ok)
        throw new Error(body.error || "Could not answer that question.");
      setAnswer(body);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not answer that question.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <article className="card finance-ask-card">
      <div className="finance-ask-heading">
        <span>
          <Sparkles size={19} />
        </span>
        <div>
          <strong>Ask your finances</strong>
          <p>
            Only your question is sent to AI. Ledgerly calculates the answer
            locally without sharing your financial records.
          </p>
        </div>
      </div>
      <form className="finance-ask-form" onSubmit={(event) => ask(event)}>
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="How much did I spend at Publix this year?"
          aria-label="Ask a question about your finances"
          maxLength={500}
        />
        <button
          className="button"
          type="submit"
          disabled={loading || question.trim().length < 3}
        >
          {loading ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <ArrowRight size={16} />
          )}
          {loading ? "Calculating" : "Ask"}
        </button>
      </form>
      <div className="finance-question-examples">
        {examples.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => ask(undefined, example)}
            disabled={loading}
          >
            {example}
          </button>
        ))}
      </div>
      {error && <p className="finance-ask-error">{error}</p>}
      {answer && (
        <section className="finance-answer" aria-live="polite">
          <span>{answer.scope}</span>
          <h3>{answer.answer}</h3>
          <p>{answer.detail}</p>
          {answer.citations.length > 0 && (
            <details>
              <summary>
                View supporting records ({answer.citations.length})
              </summary>
              <div className="finance-citations">
                {answer.citations.map((citation) => (
                  <div key={`${citation.type}-${citation.id}`}>
                    <span>
                      <b>{citation.label}</b>
                      <small>{citation.detail}</small>
                    </span>
                    {citation.amount !== undefined && (
                      <strong>{money(citation.amount)}</strong>
                    )}
                  </div>
                ))}
              </div>
            </details>
          )}
        </section>
      )}
    </article>
  );
}
