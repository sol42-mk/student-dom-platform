"use client";

import { useState, useMemo } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import {
  Transaction,
  TransactionInstruction,
  PublicKey,
} from "@solana/web3.js";

const MEMO_PROGRAM = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
);

// ── Scoring logic (hidden from user) ─────────────────────────────────────────

function incomeScore(income: number, members: number): number {
  const perMember = income / Math.max(members, 1);
  if (perMember < 3000) return 40;
  if (perMember < 6000) return 32;
  if (perMember < 9000) return 24;
  if (perMember < 12000) return 16;
  if (perMember < 15000) return 8;
  return 4;
}

function membersScore(m: number): number {
  const pts = [0, 0, 3, 6, 9, 12, 15, 15];
  return pts[Math.min(m, 7)] ?? 0;
}

function gpaScore(gpa: number): number {
  if (gpa >= 10) return 20;
  if (gpa >= 9.5) return 18;
  if (gpa >= 9) return 16;
  if (gpa >= 8.5) return 14;
  if (gpa >= 8) return 12;
  if (gpa >= 7.5) return 10;
  if (gpa >= 7) return 8;
  if (gpa >= 6.5) return 6;
  return 4;
}

function distanceScore(km: number): number {
  if (km > 100) return 15;
  if (km > 50) return 12;
  if (km > 30) return 9;
  if (km > 20) return 6;
  if (km > 10) return 3;
  return 0;
}

interface FormState {
  mesecenPrihod: string;
  brojClenovi: string;
  brojStudenti: string;
  prosecnaOcenka: string;
  godinaStudii: string;
  odalecenost: string;
  pocinalEdenRoditel: boolean;
  pocinaleDvajcaRoditeli: boolean;
  liceSoPoprecenost: boolean;
  dvajcaNeraboteni: boolean;
}

function calcTotal(form: FormState): number {
  const income = Number(form.mesecenPrihod) || 0;
  const members = Number(form.brojClenovi) || 1;
  const siblings = Number(form.brojStudenti) || 0;
  const gpa = Number(form.prosecnaOcenka) || 0;
  const km = Number(form.odalecenost) || 0;

  const sIncome = incomeScore(income, members);
  const sMembers = membersScore(members);
  const sGpa = gpaScore(gpa);
  const sDist = distanceScore(km);
  const sSiblings = Math.min(siblings * 3, 6);

  let bonus = 0;
  if (form.pocinalEdenRoditel) bonus += 10;
  if (form.pocinaleDvajcaRoditeli) bonus += 20;
  if (form.liceSoPoprecenost) bonus += 10;
  if (form.dvajcaNeraboteni) bonus += 5;
  bonus += sSiblings;

  return sIncome + sMembers + sGpa + sDist + bonus;
}

// ─────────────────────────────────────────────────────────────────────────────

const fieldClass =
  "w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100";

function SectionCard({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
          {number}
        </span>
        <h2 className="text-sm font-semibold tracking-wide text-gray-700 uppercase">
          {title}
        </h2>
      </div>
      <div className="flex flex-col gap-4 px-5 py-5">{children}</div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1 block text-xs font-medium tracking-wide text-gray-500 uppercase">
      {children}
    </span>
  );
}

async function hashApplication(
  form: FormState,
  fileNames: string[],
  walletAddress: string,
): Promise<string> {
  const payload = JSON.stringify({
    wallet: walletAddress,
    mesecenPrihod: form.mesecenPrihod,
    brojClenovi: form.brojClenovi,
    brojStudenti: form.brojStudenti,
    prosecnaOcenka: form.prosecnaOcenka,
    godinaStudii: form.godinaStudii,
    odalecenost: form.odalecenost,
    pocinalEdenRoditel: form.pocinalEdenRoditel,
    pocinaleDvajcaRoditeli: form.pocinaleDvajcaRoditeli,
    liceSoPoprecenost: form.liceSoPoprecenost,
    dvajcaNeraboteni: form.dvajcaNeraboteni,
    documents: fileNames,
  });
  const encoded = new TextEncoder().encode(payload);
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    encoded as unknown as ArrayBuffer,
  );
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function Home() {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [files, setFiles] = useState<File[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [hash, setHash] = useState<string>("");
  const [txSig, setTxSig] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [txError, setTxError] = useState<string>("");

  // Провери дали wallet-от веќе поднел пријава
  const existingApp = useMemo(() => {
    if (!publicKey) return null;
    const apps = JSON.parse(
      typeof window !== "undefined"
        ? (localStorage.getItem("applications") ?? "[]")
        : "[]",
    );
    return (
      apps.find((a: { id: string }) => a.id === publicKey.toBase58()) ?? null
    );
  }, [publicKey]);

  const [form, setForm] = useState<FormState>({
    mesecenPrihod: "",
    brojClenovi: "",
    brojStudenti: "",
    prosecnaOcenka: "",
    godinaStudii: "",
    odalecenost: "",
    pocinalEdenRoditel: false,
    pocinaleDvajcaRoditeli: false,
    liceSoPoprecenost: false,
    dvajcaNeraboteni: false,
  });

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    setFiles((prev) => [...prev, ...selected]);
    e.target.value = "";
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function updateHash(newForm: FormState, newFiles: File[]) {
    if (!publicKey) return;
    const h = await hashApplication(
      newForm,
      newFiles.map((f) => f.name),
      publicKey.toBase58(),
    );
    setHash(h);
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) {
    const target = e.target as HTMLInputElement;
    const value = target.type === "checkbox" ? target.checked : target.value;
    const newForm = { ...form, [target.name]: value } as FormState;
    setForm(newForm);
    updateHash(newForm, files);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!publicKey) return;
    setTxError("");
    setSending(true);

    const total = calcTotal(form);
    const finalHash = await hashApplication(
      form,
      files.map((f) => f.name),
      publicKey.toBase58(),
    );
    console.log("Вкупни поени (интерно):", total);
    console.log("SHA-256 хеш:", finalHash);
    setHash(finalHash);

    try {
      const memo = `STUDENTDOM:${finalHash}:SUBMITTED`;
      const memoData = new TextEncoder().encode(memo);
      const ix = new TransactionInstruction({
        keys: [{ pubkey: publicKey, isSigner: true, isWritable: false }],
        programId: MEMO_PROGRAM,
        data: Buffer.from
          ? Buffer.from(memo, "utf8")
          : (memoData as unknown as Buffer),
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
      setTxSig(sig);

      // Save to localStorage for /ujp, /dom, /mon pages
      const application = {
        id: publicKey.toBase58(),
        hash: finalHash,
        txSignature: sig,
        status: "SUBMITTED",
        score: total,
        income: Number(form.mesecenPrihod) || 0,
        members: Number(form.brojClenovi) || 1,
        gpa: Number(form.prosecnaOcenka) || 0,
        distance: Number(form.odalecenost) || 0,
        siblings: Number(form.brojStudenti) || 0,
        pocinalEdenRoditel: form.pocinalEdenRoditel,
        pocinaleDvajcaRoditeli: form.pocinaleDvajcaRoditeli,
        liceSoPoprecenost: form.liceSoPoprecenost,
        dvajcaNeraboteni: form.dvajcaNeraboteni,
        documents: files.map((f) => ({ name: f.name, fileName: f.name })),
        submittedAt: new Date().toISOString(),
      };
      const existing = JSON.parse(localStorage.getItem("applications") ?? "[]");
      const filtered = existing.filter(
        (a: { id: string }) => a.id !== application.id,
      );
      localStorage.setItem(
        "applications",
        JSON.stringify([...filtered, application]),
      );

      setSubmitted(true);
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.toLowerCase().includes("insufficient") ||
        msg.toLowerCase().includes("0x1")
      ) {
        setTxError(
          "❌ Немаш доволно SOL за gas. Земи бесплатни devnet SOL преку Airdrop копчето погоре.",
        );
      } else if (
        msg.toLowerCase().includes("user rejected") ||
        msg.toLowerCase().includes("cancelled")
      ) {
        setTxError("❌ Ја откажа трансакцијата во Phantom. Обиди се повторно.");
      } else {
        setTxError(`❌ Трансакцијата не успеа: ${msg}`);
      }
    } finally {
      setSending(false);
    }
  }

  if (submitted || existingApp) {
    const displayHash = hash || (existingApp?.hash ?? "");
    const displayTxSig = txSig || (existingApp?.txSignature ?? "");
    const displayWallet = publicKey?.toBase58() ?? existingApp?.id ?? "—";
    const alreadyExisted = !submitted && !!existingApp;
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
          {alreadyExisted && (
            <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              ⚠️ Веќе имаш поднесена пријава со овој wallet. Не можеш да
              аплицираш двапати.
            </div>
          )}
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg
              className="h-8 w-8 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="mb-2 text-xl font-bold text-gray-800">
            Пријавата е поднесена
          </h2>
          <p className="mb-1 text-sm text-gray-500">Твојот анонимен ID:</p>
          <p className="mb-4 break-all rounded-lg bg-gray-100 px-3 py-2 font-mono text-xs text-gray-600">
            {displayWallet}
          </p>
          {displayHash && (
            <>
              <p className="mb-1 text-sm text-gray-500">SHA-256 хеш:</p>
              <p className="mb-4 break-all rounded-lg bg-gray-100 px-3 py-2 font-mono text-xs text-indigo-700">
                {displayHash}
              </p>
            </>
          )}
          {displayTxSig && (
            <>
              <p className="mb-1 text-sm text-gray-500">Solana трансакција:</p>
              <p className="mb-4 break-all rounded-lg bg-gray-100 px-3 py-2 font-mono text-xs text-gray-600">
                {displayTxSig}
              </p>
              <a
                href={`https://explorer.solana.com/tx/${displayTxSig}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="mb-4 inline-block w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                Погледни на Solana Explorer ↗
              </a>
            </>
          )}
          <p className="mb-6 text-xs text-gray-400">
            Овој хеш е запишан на блокчејнот — неменлив доказ.
          </p>
          <button
            onClick={() => {
              if (!publicKey) return;
              const apps = JSON.parse(
                localStorage.getItem("applications") ?? "[]",
              );
              localStorage.setItem(
                "applications",
                JSON.stringify(
                  apps.filter(
                    (a: { id: string }) => a.id !== publicKey.toBase58(),
                  ),
                ),
              );
              setSubmitted(false);
              setHash("");
              setTxSig("");
            }}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 text-xs font-medium text-gray-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-500"
          >
            🧪 Ресетирај (Test Mode)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-gray-900">
              Студентски Дом — Пријава
            </h1>
            <p className="text-xs text-gray-400">Академска 2026/27 · DEMO</p>
          </div>
          <WalletMultiButton />
        </div>
      </header>

      {/* Wallet status */}
      <div className="mx-auto mt-5 max-w-2xl px-4">
        {!publicKey ? (
          <div className="flex items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            Поврзи го твојот Phantom wallet пред да аплицираш.
          </div>
        ) : (
          <div
            key={publicKey.toBase58()}
            className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 animate-[fadeSlideIn_0.4s_ease_both]"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
            </span>
            <span className="font-mono text-xs text-green-700 truncate">
              {publicKey.toBase58()}
            </span>
          </div>
        )}
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="mx-auto mt-6 mb-16 flex max-w-2xl flex-col gap-5 px-4"
      >
        {/* 1 — Материјална состојба */}
        <SectionCard number="1" title="Материјална состојба">
          <label>
            <FieldLabel>Вкупен месечен приход на семејство (денари)</FieldLabel>
            <input
              type="number"
              name="mesecenPrihod"
              value={form.mesecenPrihod}
              onChange={handleChange}
              placeholder="пр. 25 000"
              className={fieldClass}
            />
          </label>
          <label>
            <FieldLabel>Број на членови на семејство</FieldLabel>
            <input
              type="number"
              name="brojClenovi"
              value={form.brojClenovi}
              onChange={handleChange}
              placeholder="пр. 4"
              className={fieldClass}
            />
          </label>
          <label>
            <FieldLabel>
              Број на студенти во семејството (без кандидатот)
            </FieldLabel>
            <input
              type="number"
              name="brojStudenti"
              value={form.brojStudenti}
              onChange={handleChange}
              placeholder="пр. 1"
              className={fieldClass}
            />
          </label>
        </SectionCard>

        {/* 2 — Академски успех */}
        <SectionCard number="2" title="Академски успех">
          <label>
            <FieldLabel>Просечна оценка од претходни години</FieldLabel>
            <select
              name="prosecnaOcenka"
              value={form.prosecnaOcenka}
              onChange={handleChange}
              className={fieldClass}
            >
              <option value="">— изберете —</option>
              <option value="10">10.00</option>
              <option value="9.5">9.50 – 9.99</option>
              <option value="9">9.00 – 9.49</option>
              <option value="8.5">8.50 – 8.99</option>
              <option value="8">8.00 – 8.49</option>
              <option value="7.5">7.50 – 7.99</option>
              <option value="7">7.00 – 7.49</option>
              <option value="6.5">6.50 – 6.99</option>
              <option value="6">6.00 – 6.49</option>
            </select>
          </label>
          <label>
            <FieldLabel>Година на студии</FieldLabel>
            <select
              name="godinaStudii"
              value={form.godinaStudii}
              onChange={handleChange}
              className={fieldClass}
            >
              <option value="">— изберете —</option>
              <option value="1">Прва година (прв уписен)</option>
              <option value="2">Втора година</option>
              <option value="3">Трета година</option>
              <option value="4">Четврта година</option>
              <option value="5">Петта+ година</option>
            </select>
          </label>
          <label>
            <FieldLabel>Оддалеченост од градот на студентскиот дом</FieldLabel>
            <select
              name="odalecenost"
              value={form.odalecenost}
              onChange={handleChange}
              className={fieldClass}
            >
              <option value="">— изберете —</option>
              <option value="101">Над 100 km</option>
              <option value="75">51 – 100 km</option>
              <option value="40">31 – 50 km</option>
              <option value="25">21 – 30 km</option>
              <option value="15">11 – 20 km</option>
              <option value="5">До 10 km / Скопје</option>
            </select>
          </label>
        </SectionCard>

        {/* 3 — Посебни категории */}
        <SectionCard number="3" title="Посебни категории">
          {(
            [
              { name: "pocinalEdenRoditel", label: "Починат еден родител" },
              {
                name: "pocinaleDvajcaRoditeli",
                label: "Починати двајца родители",
              },
              {
                name: "liceSoPoprecenost",
                label: "Кандидатот е лице со попреченост",
              },
              {
                name: "dvajcaNeraboteni",
                label: "Двајца родители невработени",
              },
            ] as { name: keyof FormState; label: string }[]
          ).map(({ name, label }) => (
            <label
              key={name}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition ${
                form[name]
                  ? "border-indigo-300 bg-indigo-50"
                  : "border-gray-200 bg-gray-50 hover:bg-gray-100"
              }`}
            >
              <input
                type="checkbox"
                name={name}
                checked={form[name] as boolean}
                onChange={handleChange}
                className="h-4 w-4 rounded accent-indigo-600"
              />
              <span className="text-sm text-gray-700">{label}</span>
            </label>
          ))}
        </SectionCard>

        {/* 4 — Документи */}
        <SectionCard number="4" title="Документи (PDF)">
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-8 transition hover:border-indigo-400 hover:bg-indigo-50">
            <span className="text-3xl">📄</span>
            <span className="text-sm font-medium text-gray-600">
              Кликни или повлечи PDF документи овде
            </span>
            <span className="text-xs text-gray-400">
              Може да додадеш повеќе датотеки одеднаш
            </span>
            <input
              type="file"
              accept="application/pdf"
              multiple
              onChange={handleFiles}
              className="hidden"
            />
          </label>

          {files.length > 0 && (
            <ul className="flex flex-col gap-2">
              {files.map((file, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-2.5"
                >
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <span>📎</span>
                    <span className="font-medium">{file.name}</span>
                    <span className="text-xs text-gray-400">
                      ({(file.size / 1024).toFixed(0)} KB)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="ml-2 rounded-md p-1 text-gray-400 transition hover:bg-red-50 hover:text-red-500"
                    title="Отстрани"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {/* Live hash preview */}
        {hash && (
          <div className="rounded-xl border border-indigo-100 bg-white px-5 py-4">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">
              SHA-256 хеш (live)
            </p>
            <p className="break-all font-mono text-xs text-indigo-600">
              {hash}
            </p>
            <p className="mt-2 text-xs text-gray-400">
              Промени кое било поле — хешот ќе се смени целосно.
            </p>
          </div>
        )}

        {txError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            ⚠️ {txError}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={!publicKey || sending}
          className="w-full rounded-xl bg-indigo-600 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sending
            ? "⏳ Прати потврдување во Phantom..."
            : publicKey
              ? "Поднеси пријава →"
              : "Прво поврзи wallet"}
        </button>
      </form>
    </div>
  );
}
