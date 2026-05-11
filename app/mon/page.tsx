"use client";

import { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import {
  Transaction,
  TransactionInstruction,
  PublicKey,
} from "@solana/web3.js";
import { WalletButton } from "../components/WalletButton";

const MEMO_PROGRAM = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
);

interface Application {
  id: string;
  hash: string;
  txSignature?: string;
  status: string;
  score: number;
  income: number;
  members: number;
  gpa: number;
  distance: number;
  submittedAt: string;
  // personal — hidden before lock
  firstName?: string;
  lastName?: string;
  faculty?: string;
  ujpNote?: string;
  rejectNote?: string;
  lockedTxSignature?: string;
  flags?: string[];
}

function shortWallet(addr: string) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

export default function MonPage() {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();

  const [apps, setApps] = useState<Application[]>(() => {
    if (typeof window === "undefined") return [];
    const raw = JSON.parse(
      localStorage.getItem("applications") ?? "[]",
    ) as Application[];
    const eligible = raw.filter((a) =>
      ["DOM_DOCS_OK", "MON_LOCKED", "DEANONYMIZED"].includes(a.status),
    );
    eligible.sort((a, b) => b.score - a.score);
    return eligible;
  });
  const [locking, setLocking] = useState(false);
  const [lockError, setLockError] = useState("");

  const locked = apps.some((a) =>
    ["MON_LOCKED", "DEANONYMIZED"].includes(a.status),
  );
  const lockedTx =
    apps.find((a) => a.lockedTxSignature)?.lockedTxSignature ?? "";

  async function handleLock() {
    if (!publicKey) return;
    setLockError("");
    setLocking(true);
    try {
      // Build a combined hash of all eligible app hashes
      const combined = apps.map((a) => a.hash).join(":");
      const encoded = new TextEncoder().encode(combined);
      const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        encoded as unknown as ArrayBuffer,
      );
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const listHash = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const memo = `STUDENTDOM:${listHash}:MON_LOCKED`;
      const ix = new TransactionInstruction({
        keys: [{ pubkey: publicKey, isSigner: true, isWritable: false }],
        programId: MEMO_PROGRAM,
        data: Buffer.from
          ? Buffer.from(memo, "utf8")
          : (new TextEncoder().encode(memo) as unknown as Buffer),
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

      // Update localStorage — mark all as DEANONYMIZED, save lockedTxSignature
      const allApps = JSON.parse(
        localStorage.getItem("applications") ?? "[]",
      ) as Application[];
      const eligibleIds = new Set(apps.map((a) => a.id));
      const updated = allApps.map((a) =>
        eligibleIds.has(a.id)
          ? { ...a, status: "DEANONYMIZED", lockedTxSignature: sig }
          : a,
      );
      localStorage.setItem("applications", JSON.stringify(updated));

      // Update local state
      setApps((prev) =>
        prev.map((a) => ({
          ...a,
          status: "DEANONYMIZED",
          lockedTxSignature: sig,
        })),
      );
      // locked and lockedTx are derived from apps state — no separate setters needed
    } catch (err) {
      setLockError(String(err));
    } finally {
      setLocking(false);
    }
  }

  const stats = {
    total: apps.length,
    locked: apps.filter((a) =>
      ["MON_LOCKED", "DEANONYMIZED"].includes(a.status),
    ).length,
  };

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-medium tracking-widest text-indigo-500 uppercase">
              МОН — Министерство за образование
            </p>
            <h1 className="mt-0.5 text-xl font-bold text-gray-900">
              Анонимна ранг листа
            </h1>
          </div>
          <WalletButton />
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        {/* Nav */}
        <nav className="flex gap-2 text-xs font-medium">
          {[
            { label: "Студент", href: "/" },
            { label: "УЈП", href: "/ujp" },
            { label: "Студентски дом", href: "/dom" },
            { label: "МОН", href: "/mon" },
          ].map(({ label, href }) => (
            <a
              key={href}
              href={href}
              className={`rounded-full px-3 py-1 transition ${
                href === "/mon"
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {label}
            </a>
          ))}
        </nav>

        {/* Status bar */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Апликации", value: stats.total, color: "indigo" },
            {
              label: locked ? "Статус" : "Статус",
              value: locked ? "Заклучена ✓" : "Отворена",
              color: locked ? "green" : "yellow",
              isText: true,
            },
            {
              label: "Блокчејн запис",
              value: lockedTx ? "Потврден ✓" : "—",
              color: lockedTx ? "green" : "gray",
              isText: true,
            },
          ].map(({ label, value, color, isText }) => (
            <div
              key={label}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm text-center"
            >
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                {label}
              </p>
              <p
                className={`mt-1 text-2xl font-bold ${
                  color === "indigo"
                    ? "text-indigo-600"
                    : color === "green"
                      ? "text-green-600"
                      : color === "yellow"
                        ? "text-yellow-600"
                        : "text-gray-400"
                }`}
              >
                {isText ? value : value}
              </p>
            </div>
          ))}
        </div>

        {/* Locked TX explorer link */}
        {lockedTx && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            <span className="font-semibold">
              Листата е заклучена на Solana.
            </span>{" "}
            <a
              href={`https://explorer.solana.com/tx/${lockedTx}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-medium"
            >
              Погледни трансакција ↗
            </a>
          </div>
        )}

        {/* Lock button */}
        {!locked && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-amber-900">
                  Заклучување на листата
                </h2>
                <p className="mt-1 text-sm text-amber-700">
                  Пред заклучување — само wallet адреси и поени се видливи. По
                  заклучување — имињата и деталите се откривааат. Акцијата се
                  запишува трајно на Solana.
                </p>
              </div>
              <button
                onClick={handleLock}
                disabled={!publicKey || locking || apps.length === 0}
                className="shrink-0 rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {locking ? "Се запишува…" : "🔒 Заклучи листата"}
              </button>
            </div>
            {lockError && (
              <p className="mt-3 text-xs text-red-600">{lockError}</p>
            )}
            {!publicKey && (
              <p className="mt-2 text-xs text-amber-600">
                ⚠ Поврзи wallet за да заклучиш.
              </p>
            )}
          </div>
        )}

        {/* Rank list */}
        {apps.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-gray-400">
            <p className="text-4xl">📋</p>
            <p className="mt-2 font-medium">
              Нема апликации со статус DOM_DOCS_OK.
            </p>
            <p className="mt-1 text-sm">
              Студентски дом мора прво да ги одобри документите.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">
                {locked
                  ? "Ранг листа (деанонимизирана)"
                  : "Анонимна ранг листа"}
              </h2>
              {locked && (
                <span className="rounded-full bg-green-100 px-3 py-0.5 text-xs font-semibold text-green-700">
                  🔒 Заклучена
                </span>
              )}
            </div>

            {/* Table header */}
            <div className="grid grid-cols-12 gap-2 border-b border-gray-100 bg-gray-50 px-6 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <div className="col-span-1">#</div>
              <div className="col-span-4">
                {locked ? "Студент" : "Wallet (анонимно)"}
              </div>
              <div className="col-span-2 text-right">Поени</div>
              <div className="col-span-3 text-right">
                {locked ? "Просечна оценка" : "—"}
              </div>
              <div className="col-span-2 text-right">Статус</div>
            </div>

            {apps.map((app, idx) => {
              const isDeAnon = locked;
              const rankColor =
                idx === 0
                  ? "text-yellow-500"
                  : idx === 1
                    ? "text-gray-400"
                    : idx === 2
                      ? "text-amber-600"
                      : "text-gray-400";

              return (
                <div
                  key={app.id}
                  className={`grid grid-cols-12 gap-2 items-center border-b border-gray-50 px-6 py-4 transition hover:bg-gray-50/60 ${
                    idx === 0 ? "bg-yellow-50/40" : ""
                  }`}
                >
                  {/* Rank */}
                  <div className={`col-span-1 text-lg font-bold ${rankColor}`}>
                    {idx === 0
                      ? "🥇"
                      : idx === 1
                        ? "🥈"
                        : idx === 2
                          ? "🥉"
                          : `#${idx + 1}`}
                  </div>

                  {/* Identity */}
                  <div className="col-span-4">
                    {isDeAnon && (app.firstName || app.lastName) ? (
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">
                          {app.firstName} {app.lastName}
                        </p>
                        {app.faculty && (
                          <p className="text-xs text-gray-500">{app.faculty}</p>
                        )}
                        <p className="text-xs text-gray-400 font-mono mt-0.5">
                          {shortWallet(app.id)}
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="font-mono text-sm text-gray-700">
                          {shortWallet(app.id)}
                        </p>
                        <p className="text-xs text-gray-400">
                          🔒 идентитетот е скриен
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Score */}
                  <div className="col-span-2 text-right">
                    <span className="inline-block rounded-full bg-indigo-100 px-3 py-1 text-sm font-bold text-indigo-700">
                      {app.score}
                    </span>
                  </div>

                  {/* GPA / detail */}
                  <div className="col-span-3 text-right text-sm text-gray-600">
                    {isDeAnon ? (
                      <div className="space-y-0.5">
                        <p>
                          Оценка:{" "}
                          <span className="font-semibold">
                            {app.gpa?.toFixed(2) ?? "—"}
                          </span>
                        </p>
                        <p className="text-xs text-gray-400">
                          Далечина: {app.distance} km
                        </p>
                      </div>
                    ) : (
                      <span className="text-gray-300 text-xs">скриено</span>
                    )}
                  </div>

                  {/* Status badge */}
                  <div className="col-span-2 text-right">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        app.status === "DEANONYMIZED"
                          ? "bg-green-100 text-green-700"
                          : app.status === "MON_LOCKED"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-teal-100 text-teal-700"
                      }`}
                    >
                      {app.status === "DEANONYMIZED"
                        ? "Деанонимизирана"
                        : app.status === "MON_LOCKED"
                          ? "Заклучена"
                          : "Одобрена"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Info box */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-xs text-gray-500 leading-relaxed">
          <p className="font-semibold text-gray-700 mb-1">
            ℹ️ Како функционира?
          </p>
          <p>
            Пред заклучување: само wallet адреса и поени се видливи — ниту МОН
            не знае чија е пријавата. Кога МОН ќе стисне{" "}
            <strong>Заклучи листата</strong>, SHA-256 хешот на целата листа се
            запишува на Solana Devnet. По тоа, системот ги открива имињата
            (деанонимизација). Записот на блокчејнот е непроменлив доказ дека
            листата не е менувана по заклучувањето.
          </p>
        </div>
      </div>
    </main>
  );
}
