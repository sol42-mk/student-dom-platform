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
  siblings: number;
  pocinalEdenRoditel: boolean;
  pocinaleDvajcaRoditeli: boolean;
  liceSoPoprecenost: boolean;
  dvajcaNeraboteni: boolean;
  documents: { name: string; fileName: string }[];
  submittedAt: string;
  ujpVerified?: boolean;
  ujpNote?: string;
  ujpTxSig?: string;
}

const statusLabel: Record<string, { label: string; color: string }> = {
  SUBMITTED: { label: "Чека верификација", color: "amber" },
  UJP_VERIFIED: { label: "УЈП потврдено", color: "green" },
  UJP_REJECTED: { label: "УЈП одбиено", color: "red" },
};

function StatusBadge({ status }: { status: string }) {
  const s = statusLabel[status] ?? { label: status, color: "gray" };
  const colors: Record<string, string> = {
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    green: "bg-green-50 text-green-700 border-green-200",
    red: "bg-red-50 text-red-700 border-red-200",
    gray: "bg-gray-50 text-gray-600 border-gray-200",
  };
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${colors[s.color]}`}
    >
      {s.label}
    </span>
  );
}

export default function UJPPage() {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();

  const [apps, setApps] = useState<Application[]>(() => {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem("applications");
    return raw ? JSON.parse(raw) : [];
  });
  const [selected, setSelected] = useState<Application | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState("");

  // Load from localStorage
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

  async function handleVerify(app: Application) {
    if (!publicKey) return;
    setActing(true);
    setActionError("");
    try {
      const sig = await sendMemoTx(`STUDENTDOM:${app.hash}:UJP_VERIFIED`);
      const updated = apps.map((a) =>
        a.id === app.id
          ? { ...a, status: "UJP_VERIFIED", ujpVerified: true, ujpTxSig: sig }
          : a,
      );
      saveApps(updated);
      setSelected(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionError(`❌ Трансакцијата не успеа: ${msg}`);
    } finally {
      setActing(false);
    }
  }

  async function handleReject(app: Application) {
    if (!rejectNote.trim()) {
      setActionError("❌ Мора да внесеш причина за одбивање.");
      return;
    }
    if (!publicKey) return;
    setActing(true);
    setActionError("");
    try {
      const sig = await sendMemoTx(`STUDENTDOM:${app.hash}:UJP_REJECTED`);
      const updated = apps.map((a) =>
        a.id === app.id
          ? {
              ...a,
              status: "UJP_REJECTED",
              ujpVerified: false,
              ujpNote: rejectNote,
              ujpTxSig: sig,
            }
          : a,
      );
      saveApps(updated);
      setSelected(null);
      setRejectNote("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionError(`❌ Трансакцијата не успеа: ${msg}`);
    } finally {
      setActing(false);
    }
  }

  // Format income nicely
  function fmt(n: number) {
    return n.toLocaleString("mk-MK") + " ден.";
  }

  const pending = apps.filter((a) => a.status === "SUBMITTED");
  const done = apps.filter((a) => a.status !== "SUBMITTED");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-blue-600 px-2 py-0.5 text-xs font-bold text-white">
                УЈП
              </span>
              <h1 className="text-base font-bold text-gray-900">
                Управа за јавни приходи — Верификација
              </h1>
            </div>
            <p className="mt-0.5 text-xs text-gray-400">
              Верификација на финансиски податоци · DEMO
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              ← Студент
            </Link>
            <WalletButton />
          </div>
        </div>
      </header>

      <div className="mx-auto mt-6 max-w-3xl px-4 pb-16">
        {/* Wallet warning */}
        {!publicKey && (
          <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            ⚠️ Поврзи wallet за да можеш да потврдуваш/одбиваш апликации (Solana
            tx).
          </div>
        )}

        {/* Stats bar */}
        <div className="mb-6 flex gap-4">
          {[
            { label: "Чекаат", value: pending.length, color: "amber" },
            {
              label: "Потврдени",
              value: apps.filter((a) => a.status === "UJP_VERIFIED").length,
              color: "green",
            },
            {
              label: "Одбиени",
              value: apps.filter((a) => a.status === "UJP_REJECTED").length,
              color: "red",
            },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className={`flex-1 rounded-xl border bg-white px-4 py-3 shadow-sm ${
                color === "amber"
                  ? "border-amber-100"
                  : color === "green"
                    ? "border-green-100"
                    : "border-red-100"
              }`}
            >
              <p
                className={`text-2xl font-bold ${
                  color === "amber"
                    ? "text-amber-600"
                    : color === "green"
                      ? "text-green-600"
                      : "text-red-600"
                }`}
              >
                {value}
              </p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          ))}
        </div>

        {/* Pending list */}
        {pending.length === 0 && done.length === 0 && (
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

        {pending.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Чекаат верификација ({pending.length})
            </h2>
            <div className="flex flex-col gap-3">
              {pending.map((app) => (
                <div
                  key={app.id}
                  className="rounded-xl border border-gray-200 bg-white shadow-sm"
                >
                  {/* Card header */}
                  <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
                    <div>
                      <p className="font-mono text-xs text-gray-500">
                        {app.id.slice(0, 16)}…
                      </p>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {new Date(app.submittedAt).toLocaleString("mk-MK")}
                      </p>
                    </div>
                    <StatusBadge status={app.status} />
                  </div>

                  {/* Financial data visible to УЈП */}
                  <div className="grid grid-cols-3 gap-4 px-5 py-4">
                    <div>
                      <p className="text-xs text-gray-400">Месечен приход</p>
                      <p className="mt-0.5 text-sm font-semibold text-gray-800">
                        {fmt(app.income)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Членови</p>
                      <p className="mt-0.5 text-sm font-semibold text-gray-800">
                        {app.members}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">По член</p>
                      <p className="mt-0.5 text-sm font-semibold text-gray-800">
                        {fmt(Math.round(app.income / Math.max(app.members, 1)))}
                      </p>
                    </div>
                  </div>

                  {/* Action panel */}
                  {selected?.id === app.id ? (
                    <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
                      <p className="mb-2 text-xs font-medium text-gray-600">
                        Причина за одбивање (задолжително ако одбиваш):
                      </p>
                      <textarea
                        value={rejectNote}
                        onChange={(e) => setRejectNote(e.target.value)}
                        placeholder="пр. Приходите не соодветствуваат со поднесените документи..."
                        rows={2}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                      />
                      {actionError && (
                        <p className="mt-2 text-xs text-red-600">
                          {actionError}
                        </p>
                      )}
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => handleVerify(app)}
                          disabled={acting || !publicKey}
                          className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
                        >
                          {acting ? "⏳ Phantom..." : "✓ Потврди"}
                        </button>
                        <button
                          onClick={() => handleReject(app)}
                          disabled={acting || !publicKey}
                          className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                        >
                          {acting ? "⏳ Phantom..." : "✕ Одбие"}
                        </button>
                        <button
                          onClick={() => {
                            setSelected(null);
                            setRejectNote("");
                            setActionError("");
                          }}
                          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-500 hover:bg-gray-50"
                        >
                          Откажи
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="border-t border-gray-100 px-5 py-3">
                      <button
                        onClick={() => {
                          setSelected(app);
                          setRejectNote("");
                          setActionError("");
                        }}
                        disabled={!publicKey}
                        className="w-full rounded-lg border border-indigo-200 bg-indigo-50 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-40"
                      >
                        Разгледај →
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Done list */}
        {done.length > 0 && (
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Обработени ({done.length})
            </h2>
            <div className="flex flex-col gap-3">
              {done.map((app) => (
                <div
                  key={app.id}
                  className="rounded-xl border border-gray-200 bg-white shadow-sm"
                >
                  <div className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="font-mono text-xs text-gray-500">
                        {app.id.slice(0, 16)}…
                      </p>
                      {app.ujpNote && (
                        <p className="mt-0.5 text-xs text-red-600">
                          Причина: {app.ujpNote}
                        </p>
                      )}
                      {app.ujpTxSig && (
                        <a
                          href={`https://explorer.solana.com/tx/${app.ujpTxSig}?cluster=devnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-0.5 block font-mono text-xs text-indigo-500 hover:underline"
                        >
                          tx: {app.ujpTxSig.slice(0, 20)}… ↗
                        </a>
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
