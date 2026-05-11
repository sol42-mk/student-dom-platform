"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

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

export default function Home() {
  const { publicKey } = useWallet();
  const [files, setFiles] = useState<File[]>([]);
  const [submitted, setSubmitted] = useState(false);

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

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) {
    const target = e.target as HTMLInputElement;
    const value = target.type === "checkbox" ? target.checked : target.value;
    setForm((prev) => ({ ...prev, [target.name]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const total = calcTotal(form);
    console.log("Вкупни поени (интерно):", total);
    console.log("Прикачени документи:", files.map((f) => f.name));
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="mb-2 text-xl font-bold text-gray-800">Пријавата е поднесена</h2>
          <p className="mb-1 text-sm text-gray-500">Твојот анонимен ID:</p>
          <p className="mb-6 break-all rounded-lg bg-gray-100 px-3 py-2 font-mono text-xs text-gray-600">
            {publicKey?.toBase58() ?? "—"}
          </p>
          <p className="text-xs text-gray-400">Зачувај го овој ID за следење на статусот.</p>
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
            <h1 className="text-base font-bold text-gray-900">Студентски Дом — Пријава</h1>
            <p className="text-xs text-gray-400">Академска 2026/27 · DEMO</p>
          </div>
          <WalletMultiButton />
        </div>
      </header>

      {/* Wallet notice */}
      {!publicKey && (
        <div className="mx-auto mt-6 max-w-2xl px-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            ⚠️ Поврзи го твојот Phantom wallet пред да аплицираш.
          </div>
        </div>
      )}

      {publicKey && (
        <div className="mx-auto mt-6 max-w-2xl px-4">
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 font-mono text-xs text-green-700">
            ✓ Поврзан · {publicKey.toBase58()}
          </div>
        </div>
      )}

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
            <FieldLabel>Број на студенти во семејството (без кандидатот)</FieldLabel>
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
            <select name="prosecnaOcenka" value={form.prosecnaOcenka} onChange={handleChange} className={fieldClass}>
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
            <select name="godinaStudii" value={form.godinaStudii} onChange={handleChange} className={fieldClass}>
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
            <select name="odalecenost" value={form.odalecenost} onChange={handleChange} className={fieldClass}>
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
              { name: "pocinalEdenRoditel",     label: "Починат еден родител" },
              { name: "pocinaleDvajcaRoditeli", label: "Починати двајца родители" },
              { name: "liceSoPoprecenost",       label: "Кандидатот е лице со попреченост" },
              { name: "dvajcaNeraboteni",        label: "Двајца родители невработени" },
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
            <span className="text-sm font-medium text-gray-600">Кликни или повлечи PDF документи овде</span>
            <span className="text-xs text-gray-400">Може да додадеш повеќе датотеки одеднаш</span>
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
                    <span className="text-xs text-gray-400">({(file.size / 1024).toFixed(0)} KB)</span>
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

        {/* Submit */}
        <button
          type="submit"
          disabled={!publicKey}
          className="w-full rounded-xl bg-indigo-600 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {publicKey ? "Поднеси пријава →" : "Прво поврзи wallet"}
        </button>
      </form>
    </div>
  );
}
