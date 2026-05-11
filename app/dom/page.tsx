"use client";

import { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletButton } from "../components/WalletButton";
import {
  Transaction,
  TransactionInstruction,
  PublicKey,
} from "@solana/web3.js";
import Link from "next/link";

const MEMO_PROGRAM = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
);

interface DocState {
  name: string;
  fileName: string;
  dataUrl?: string;
  accepted?: boolean;
  rejectedCount?: number;
  reason?: string;
  flagged?: boolean;
}

interface Application {
  id: string;
  hash: string;
  txSignature: string;
  status: string;
  score: number;
  income: number;
  members: number;
  gpa: number;
  distance: number;
  documents: DocState[];
  submittedAt: string;
  ujpVerified?: boolean;
  ujpNote?: string;
  docsVerified?: boolean;
  flags?: string[];
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    SUBMITTED: {
      label: "Поднесена",
      cls: "bg-gray-100 text-gray-600 border-gray-200",
    },
    UJP_VERIFIED: {
      label: "УЈП ✓",
      cls: "bg-green-50 text-green-700 border-green-200",
    },
    UJP_REJECTED: {
      label: "УЈП ✕",
      cls: "bg-red-50 text-red-600 border-red-200",
    },
    DOM_DOCS_OK: {
      label: "Документи ✓",
      cls: "bg-indigo-50 text-indigo-700 border-indigo-200",
    },
    DOM_DOCS_FLAGGED: {
      label: "🚩 Пријавено",
      cls: "bg-red-50 text-red-700 border-red-200",
    },
  };
  const s = map[status] ?? {
    label: status,
    cls: "bg-gray-100 text-gray-500 border-gray-200",
  };
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.cls}`}
    >
      {s.label}
    </span>
  );
}

export default function DomPage() {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();

  const [apps, setApps] = useState<Application[]>(() => {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem("applications");
    return raw ? JSON.parse(raw) : [];
  });

  // Which application is expanded
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Per-doc reject reason input (keyed by `appId:docIndex`)
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [reasonErrors, setReasonErrors] = useState<Record<string, boolean>>({});
  const [acting, setActing] = useState<string | null>(null); // key of acting doc
  const [txError, setTxError] = useState("");

  function saveApps(updated: Application[]) {
    localStorage.setItem("applications", JSON.stringify(updated));
    setApps(updated);
  }

  async function sendMemoTx(memo: string): Promise<string> {
    if (!publicKey) throw new Error("Wallet not connected");
    const memoData = new TextEncoder().encode(memo);
    const ix = new TransactionInstruction({
      keys: [{ pubkey: publicKey, isSigner: true, isWritable: false }],
      programId: MEMO_PROGRAM,
      data: memoData as unknown as Buffer,
    });
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed");
    const tx = new Transaction({
      recentBlockhash: blockhash,
      feePayer: publicKey,
    }).add(ix);
    const sig = await sendTransaction(tx, connection, {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });
    await connection.confirmTransaction(
      { signature: sig, blockhash, lastValidBlockHeight },
      "confirmed",
    );
    return sig;
  }

  async function handleAccept(app: Application, docIdx: number) {
    const key = `${app.id}:${docIdx}`;
    setActing(key);
    setTxError("");
    try {
      await sendMemoTx(`STUDENTDOM:${app.hash}:DOC_OK:${docIdx}`);
      const updated = apps.map((a) => {
        if (a.id !== app.id) return a;
        const docs = a.documents.map((d, i) =>
          i === docIdx ? { ...d, accepted: true } : d,
        );
        const allDone = docs.every((d) => d.accepted !== undefined);
        const anyFlagged = docs.some((d) => d.flagged);
        const newStatus =
          allDone && !anyFlagged
            ? "DOM_DOCS_OK"
            : anyFlagged
              ? "DOM_DOCS_FLAGGED"
              : a.status;
        return { ...a, documents: docs, status: newStatus };
      });
      saveApps(updated);
    } catch (err) {
      setTxError(`❌ ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setActing(null);
    }
  }

  async function handleReject(app: Application, docIdx: number) {
    const key = `${app.id}:${docIdx}`;
    const reason = reasons[key]?.trim();
    if (!reason) {
      setReasonErrors((prev) => ({ ...prev, [key]: true }));
      return;
    }
    setReasonErrors((prev) => ({ ...prev, [key]: false }));
    setActing(key);
    setTxError("");
    try {
      await sendMemoTx(`STUDENTDOM:${app.hash}:DOC_REJECTED:${docIdx}`);
      const updated = apps.map((a) => {
        if (a.id !== app.id) return a;
        const docs = a.documents.map((d, i) => {
          if (i !== docIdx) return d;
          const newCount = (d.rejectedCount ?? 0) + 1;
          const flagged = newCount >= 2;
          return {
            ...d,
            accepted: false,
            rejectedCount: newCount,
            reason,
            flagged,
          };
        });
        const anyFlagged = docs.some((d) => d.flagged);
        const flags = anyFlagged
          ? [
              ...(a.flags ?? []),
              `Документ ${docIdx + 1} одбиен 2 пати: ${reason}`,
            ]
          : a.flags;
        return {
          ...a,
          documents: docs,
          flags,
          status: anyFlagged ? "DOM_DOCS_FLAGGED" : a.status,
        };
      });
      saveApps(updated);
      // Clear reason input
      setReasons((prev) => ({ ...prev, [key]: "" }));
    } catch (err) {
      setTxError(`❌ ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setActing(null);
    }
  }

  const eligible = apps.filter((a) => a.status === "UJP_VERIFIED");
  const other = apps.filter(
    (a) => a.status === "DOM_DOCS_OK" || a.status === "DOM_DOCS_FLAGGED",
  );
  const notReady = apps.filter(
    (a) => a.status === "SUBMITTED" || a.status === "UJP_REJECTED",
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-indigo-600 px-2 py-0.5 text-xs font-bold text-white">
                ДОМ
              </span>
              <h1 className="text-base font-bold text-gray-900">
                Студентски Дом — Преглед на документи
              </h1>
            </div>
            <p className="mt-0.5 text-xs text-gray-400">
              Верификација на документи · DEMO
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/ujp"
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              ← УЈП
            </Link>
            <WalletButton />
          </div>
        </div>
      </header>

      <div className="mx-auto mt-6 max-w-3xl px-4 pb-16">
        {/* Wallet warning */}
        {!publicKey && (
          <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            ⚠️ Поврзи wallet за да можеш да потврдуваш документи (Solana tx).
          </div>
        )}

        {txError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {txError}
          </div>
        )}

        {/* Stats */}
        <div className="mb-6 flex gap-4">
          {[
            { label: "За преглед", value: eligible.length, color: "amber" },
            {
              label: "Одобрени",
              value: other.filter((a) => a.status === "DOM_DOCS_OK").length,
              color: "green",
            },
            {
              label: "🚩 Пријавени",
              value: other.filter((a) => a.status === "DOM_DOCS_FLAGGED")
                .length,
              color: "red",
            },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className={`flex-1 rounded-xl border bg-white px-4 py-3 shadow-sm ${color === "amber" ? "border-amber-100" : color === "green" ? "border-green-100" : "border-red-100"}`}
            >
              <p
                className={`text-2xl font-bold ${color === "amber" ? "text-amber-600" : color === "green" ? "text-green-600" : "text-red-600"}`}
              >
                {value}
              </p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          ))}
        </div>

        {/* Not ready notice */}
        {notReady.length > 0 && eligible.length === 0 && other.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white px-6 py-10 text-center shadow-sm">
            <p className="text-2xl">⏳</p>
            <p className="mt-2 text-sm font-medium text-gray-600">
              Апликациите чекаат УЈП верификација
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Прво потврди ги на{" "}
              <Link href="/ujp" className="text-indigo-600 hover:underline">
                /ujp
              </Link>
            </p>
          </div>
        )}

        {apps.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center shadow-sm">
            <p className="text-2xl">📭</p>
            <p className="mt-2 text-sm font-medium text-gray-600">
              Нема апликации
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Прво поднеси пријава на{" "}
              <Link href="/" className="text-indigo-600 hover:underline">
                /
              </Link>
            </p>
          </div>
        )}

        {/* Eligible apps */}
        {eligible.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Чекаат преглед на документи ({eligible.length})
            </h2>
            <div className="flex flex-col gap-4">
              {eligible.map((app) => {
                const isExpanded = expandedId === app.id;
                return (
                  <div
                    key={app.id}
                    className="rounded-xl border border-gray-200 bg-white shadow-sm"
                  >
                    {/* App header */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : app.id)}
                      className="flex w-full items-center justify-between border-b border-gray-100 px-5 py-3 text-left"
                    >
                      <div>
                        <p className="font-mono text-xs text-gray-500">
                          {app.id.slice(0, 20)}…
                        </p>
                        <p className="mt-0.5 text-xs text-gray-400">
                          {app.documents.length} документ
                          {app.documents.length !== 1 ? "и" : ""}
                          {" · "}
                          {
                            app.documents.filter(
                              (d) => d.accepted !== undefined,
                            ).length
                          }{" "}
                          обработени
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusBadge status={app.status} />
                        <span className="text-gray-400">
                          {isExpanded ? "▲" : "▼"}
                        </span>
                      </div>
                    </button>

                    {/* Documents */}
                    {isExpanded && (
                      <div className="divide-y divide-gray-100">
                        {app.documents.length === 0 && (
                          <p className="px-5 py-4 text-xs text-gray-400">
                            Нема прикачени документи.
                          </p>
                        )}
                        {app.documents.map((doc, idx) => {
                          const key = `${app.id}:${idx}`;
                          const isDone = doc.accepted !== undefined;
                          const isActing = acting === key;
                          return (
                            <div key={idx} className="px-5 py-4">
                              {/* Doc name */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-lg">📎</span>
                                  <span className="text-sm font-medium text-gray-700">
                                    {doc.fileName}
                                  </span>
                                  {doc.dataUrl && (
                                    <button
                                      onClick={() => {
                                        const base64 =
                                          doc.dataUrl!.split(",")[1];
                                        const bytes = Uint8Array.from(
                                          atob(base64),
                                          (c) => c.charCodeAt(0),
                                        );
                                        const blob = new Blob([bytes], {
                                          type: "application/pdf",
                                        });
                                        const url = URL.createObjectURL(blob);
                                        window.open(url, "_blank");
                                      }}
                                      className="rounded border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600 hover:bg-indigo-100"
                                    >
                                      Отвори PDF ↗
                                    </button>
                                  )}
                                  {doc.flagged && (
                                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                                      🚩 ПРИЈАВЕН
                                    </span>
                                  )}
                                </div>
                                {isDone && (
                                  <span
                                    className={`text-xs font-semibold ${doc.accepted ? "text-green-600" : "text-red-600"}`}
                                  >
                                    {doc.accepted
                                      ? "✓ Прифатен"
                                      : `✕ Одбиен (${doc.rejectedCount}×)`}
                                  </span>
                                )}
                              </div>

                              {/* Previous rejection reason */}
                              {doc.reason && (
                                <p className="mt-1 text-xs text-red-600">
                                  Причина: {doc.reason}
                                </p>
                              )}

                              {/* Action area — always show if not accepted (allow re-rejection) */}
                              {doc.accepted !== true && (
                                <div className="mt-3">
                                  <textarea
                                    value={reasons[key] ?? ""}
                                    onChange={(e) => {
                                      setReasons((prev) => ({
                                        ...prev,
                                        [key]: e.target.value,
                                      }));
                                      if (e.target.value.trim()) {
                                        setReasonErrors((prev) => ({
                                          ...prev,
                                          [key]: false,
                                        }));
                                      }
                                    }}
                                    placeholder="Причина за одбивање (задолжително ако одбиваш)..."
                                    rows={2}
                                    className={`w-full rounded-lg border px-3 py-2 text-sm text-gray-800 outline-none transition focus:ring-2 focus:ring-indigo-100 ${
                                      reasonErrors[key]
                                        ? "border-red-400 bg-red-50 focus:border-red-400"
                                        : "border-gray-200 bg-gray-50 focus:border-indigo-400"
                                    }`}
                                  />
                                  {reasonErrors[key] && (
                                    <p className="mt-1 text-xs font-medium text-red-600">
                                      ⚠️ Мора да внесеш причина пред да одбиеш.
                                    </p>
                                  )}
                                  <div className="mt-2 flex gap-2">
                                    <button
                                      onClick={() => handleAccept(app, idx)}
                                      disabled={isActing || !publicKey}
                                      className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
                                    >
                                      {isActing ? "⏳ Phantom..." : "✓ Прифати"}
                                    </button>
                                    <button
                                      onClick={() => handleReject(app, idx)}
                                      disabled={isActing || !publicKey}
                                      className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                                    >
                                      {isActing ? "⏳ Phantom..." : "✕ Одбие"}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Done apps */}
        {other.length > 0 && (
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Обработени ({other.length})
            </h2>
            <div className="flex flex-col gap-3">
              {other.map((app) => (
                <div
                  key={app.id}
                  className="rounded-xl border border-gray-200 bg-white shadow-sm"
                >
                  <div className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="font-mono text-xs text-gray-500">
                        {app.id.slice(0, 20)}…
                      </p>
                      {app.flags && app.flags.length > 0 && (
                        <div className="mt-1 flex flex-col gap-0.5">
                          {app.flags.map((f, i) => (
                            <p key={i} className="text-xs text-red-600">
                              🚩 {f}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                    <StatusBadge status={app.status} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
