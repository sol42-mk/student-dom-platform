"use client";

import { useState, useMemo } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import {
  Transaction,
  TransactionInstruction,
  PublicKey,
} from "@solana/web3.js";

const MEMO_PROGRAM = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
);

// ── Scoring ───────────────────────────────────────────────────────────────────
function incomeScore(income: number, members: number): number {
  const pp = income / Math.max(members, 1);
  if (pp < 3000) return 40;
  if (pp < 6000) return 32;
  if (pp < 9000) return 24;
  if (pp < 12000) return 16;
  if (pp < 15000) return 8;
  return 4;
}
function membersScore(m: number): number {
  return ([0, 0, 3, 6, 9, 12, 15, 15] as number[])[Math.min(m, 7)] ?? 0;
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

// ── Types ─────────────────────────────────────────────────────────────────────
interface BratSestraEntry {
  ime: string;
  prezime: string;
  embg: string;
  status: "" | "nevraboten" | "ucenik_student" | "pod6god" | "drug";
}

interface FormState {
  ime: string;
  prezime: string;
  tatkovoIme: string;
  pol: string;
  embg: string;
  datumRaganje: string;
  pripadnost: string;
  opstina: string;
  adresa: string;
  tatkoIme: string;
  tatkoPrezime: string;
  tatkoEmbg: string;
  tatkoStatus: "" | "nevraboten" | "nadomeshtok" | "pochinат";
  majkaIme: string;
  majkaPrezime: string;
  majkaEmbg: string;
  majkaStatus: "" | "nevrabotena" | "nadomeshtok" | "pochinata";
  primerenDom: string;
  alternativenDom: string;
  fakultet: string;
  univerzitet: string;
  prosecnaOcenka: string;
  godinaStudii: string;
  odalecenost: string;
  brojClenovi: string;
  brojStudenti: string;
  brojUcenici: string;
  tatkoPlata: string;
  majkaPlata: string;
  drugiPrimanja: string;
  liceSoPoprecenost: boolean;
  branitelDete: boolean;
}

const defaultForm: FormState = {
  ime: "",
  prezime: "",
  tatkovoIme: "",
  pol: "",
  embg: "",
  datumRaganje: "",
  pripadnost: "",
  opstina: "",
  adresa: "",
  tatkoIme: "",
  tatkoPrezime: "",
  tatkoEmbg: "",
  tatkoStatus: "",
  majkaIme: "",
  majkaPrezime: "",
  majkaEmbg: "",
  majkaStatus: "",
  primerenDom: "",
  alternativenDom: "",
  fakultet: "",
  univerzitet: "",
  prosecnaOcenka: "",
  godinaStudii: "",
  odalecenost: "",
  brojClenovi: "",
  brojStudenti: "",
  brojUcenici: "",
  tatkoPlata: "",
  majkaPlata: "",
  drugiPrimanja: "",
  liceSoPoprecenost: false,
  branitelDete: false,
};

function deriveScoring(form: FormState, bratSestra: BratSestraEntry[]) {
  const income =
    (Number(form.tatkoPlata) || 0) +
    (Number(form.majkaPlata) || 0) +
    (Number(form.drugiPrimanja) || 0);
  const members = Number(form.brojClenovi) || 1;
  const gpa = Number(form.prosecnaOcenka) || 0;
  const km = Number(form.odalecenost) || 0;

  const tatkoPochinat = form.tatkoStatus === "pochinат";
  const majkaPochinata = form.majkaStatus === "pochinata";
  const pocinalEdenRoditel =
    (tatkoPochinat || majkaPochinata) && !(tatkoPochinat && majkaPochinata);
  const pocinaleDvajcaRoditeli = tatkoPochinat && majkaPochinata;
  const dvajcaNeraboteni =
    form.tatkoStatus === "nevraboten" && form.majkaStatus === "nevrabotena";
  const siblingsStudenti = bratSestra.filter(
    (b) => b.status === "ucenik_student",
  ).length;

  let bonus = 0;
  if (pocinalEdenRoditel) bonus += 10;
  if (pocinaleDvajcaRoditeli) bonus += 20;
  if (form.liceSoPoprecenost) bonus += 10;
  if (dvajcaNeraboteni) bonus += 5;
  if (form.branitelDete) bonus += 5;
  bonus += Math.min(siblingsStudenti * 3, 6);

  return {
    total:
      incomeScore(income, members) +
      membersScore(members) +
      gpaScore(gpa) +
      distanceScore(km) +
      bonus,
    income,
    pocinalEdenRoditel,
    pocinaleDvajcaRoditeli,
    dvajcaNeraboteni,
  };
}

async function buildHash(
  form: FormState,
  bratSestra: BratSestraEntry[],
  docNames: string[],
  wallet: string,
): Promise<string> {
  const payload = JSON.stringify({
    wallet,
    form,
    bratSestra,
    documents: docNames,
  });
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(payload) as unknown as ArrayBuffer,
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── UI Helpers ────────────────────────────────────────────────────────────────
const fieldClass =
  "w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100";

function SectionCard({
  number,
  title,
  badge,
  children,
}: {
  number: string;
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
          {number}
        </span>
        <h2 className="flex-1 text-sm font-semibold uppercase tracking-wide text-gray-700">
          {title}
        </h2>
        {badge && (
          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-600">
            {badge}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-4 px-5 py-5">{children}</div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
      {children}
    </span>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

function Row3({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-3 gap-3">{children}</div>;
}

function DocSlot({
  label,
  required,
  file,
  onChange,
}: {
  label: string;
  required?: boolean;
  file: File | null;
  onChange: (f: File | null) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight text-gray-700">
          {label}
          {required && <span className="ml-1 text-red-500">*</span>}
        </p>
        {file && (
          <p className="mt-0.5 truncate text-xs text-indigo-600">{file.name}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {file && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs text-gray-400 hover:text-red-500"
          >
            ✕
          </button>
        )}
        <label className="cursor-pointer rounded border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-600 transition hover:bg-indigo-100">
          {file ? "Замени" : "Прикачи PDF"}
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              onChange(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>
    </div>
  );
}

const DOMOVI = [
  "Studentski dom Kuzman Josifovski Pitu - Skopje",
  "Studentski dom Brakja Miladinovci - Skopje",
  "Studentski dom Stiv Naumov - Bitola",
  "Studentski dom Goce Delcev - Stip",
  "Studentski dom Nikola Karev - Ohrid",
];

const UNIVERS = [
  "Univerzitet Sv. Kiril i Metodij - Skopje (UKIM)",
  "Univerzitet Sv. Kliment Ohridski - Bitola",
  "Drzhaven Univerzitet Tetovo",
  "Univerzitet na Jugoistochna Evropa - Tetovo",
  "Univerzitet Goce Delcev - Stip",
  "Univerzitet za informatika i komunikaciski tehnologii (FON)",
];

const DOC_SLOTS: { key: string; label: string; required: boolean }[] = [
  {
    key: "potvrda_student",
    label: "Potvrda za redoven student",
    required: true,
  },
  {
    key: "uverenie_ispiti",
    label: "Uverenie so broj na predvideni i polozeni ispiti",
    required: true,
  },
  { key: "uppi", label: "Zaveren UPPI obrazec", required: true },
  {
    key: "potvrda_plata",
    label: "Potvrda za ostvarena plata (ili .zip so povekje potvrdi)",
    required: true,
  },
  {
    key: "izjava_semejstvo",
    label: "Izjava za semejnata polozba na studentot",
    required: true,
  },
  {
    key: "izjava_podatoci",
    label: "Izjava za koristenje na lichnite podatoci",
    required: true,
  },
  {
    key: "izjava_identicnost",
    label: "Izjava za identicnost na podatocite",
    required: true,
  },
  {
    key: "izjava_roditel",
    label: "Izjava od roditel-staratel za trosocite",
    required: true,
  },
  {
    key: "dokaz_branitel",
    label: "Dokaz za dete na zaginat/pochinат pripadnik - braniteli",
    required: false,
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Home() {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();

  const [form, setForm] = useState<FormState>(defaultForm);
  const [bratSestra, setBratSestra] = useState<BratSestraEntry[]>([]);
  const [bratSestraFiles, setBratSestraFiles] = useState<
    Record<number, File | null>
  >({});
  const [namedDocs, setNamedDocs] = useState<Record<string, File | null>>({});
  const [hash, setHash] = useState("");
  const [txSig, setTxSig] = useState("");
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [txError, setTxError] = useState("");

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

  const scoring = deriveScoring(form, bratSestra);

  async function recomputeHash(
    f: FormState,
    bs: BratSestraEntry[],
    nd: Record<string, File | null>,
  ) {
    if (!publicKey) return;
    const docNames = Object.entries(nd)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}:${v!.name}`);
    const h = await buildHash(f, bs, docNames, publicKey.toBase58());
    setHash(h);
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) {
    const target = e.target as HTMLInputElement;
    const value = target.type === "checkbox" ? target.checked : target.value;
    const newForm = { ...form, [target.name]: value } as FormState;
    setForm(newForm);
    recomputeHash(newForm, bratSestra, namedDocs);
  }

  function setBratSestraField(
    idx: number,
    field: keyof BratSestraEntry,
    value: string,
  ) {
    const next = bratSestra.map((b, i) =>
      i === idx ? { ...b, [field]: value } : b,
    );
    setBratSestra(next);
    recomputeHash(form, next, namedDocs);
  }

  function setNamedDoc(key: string, file: File | null) {
    const next = { ...namedDocs, [key]: file };
    setNamedDocs(next);
    recomputeHash(form, bratSestra, next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!publicKey) return;
    setTxError("");
    setSending(true);

    const {
      total,
      income,
      pocinalEdenRoditel,
      pocinaleDvajcaRoditeli,
      dvajcaNeraboteni,
    } = deriveScoring(form, bratSestra);

    const docNames = Object.entries(namedDocs)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}:${v!.name}`);
    const finalHash = await buildHash(
      form,
      bratSestra,
      docNames,
      publicKey.toBase58(),
    );
    setHash(finalHash);

    try {
      const memo = `STUDENTDOM:${finalHash}:SUBMITTED`;
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
      setTxSig(sig);

      const toBase64 = (file: File): Promise<string> =>
        new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result as string);
          r.onerror = rej;
          r.readAsDataURL(file);
        });

      const allDocs: { name: string; fileName: string; dataUrl: string }[] = [];
      for (const [key, file] of Object.entries(namedDocs)) {
        if (file) {
          allDocs.push({
            name: key,
            fileName: file.name,
            dataUrl: await toBase64(file),
          });
        }
      }
      for (const [idx, file] of Object.entries(bratSestraFiles)) {
        if (file) {
          allDocs.push({
            name: `brat_sestra_${idx}_potvrda`,
            fileName: file.name,
            dataUrl: await toBase64(file),
          });
        }
      }

      const application = {
        id: publicKey.toBase58(),
        hash: finalHash,
        txSignature: sig,
        status: "SUBMITTED",
        score: total,
        firstName: form.ime,
        lastName: form.prezime,
        faculty: `${form.fakultet} - ${form.univerzitet}`,
        income,
        members: Number(form.brojClenovi) || 1,
        gpa: Number(form.prosecnaOcenka) || 0,
        distance: Number(form.odalecenost) || 0,
        siblings: Number(form.brojStudenti) || 0,
        pocinalEdenRoditel,
        pocinaleDvajcaRoditeli,
        dvajcaNeraboteni,
        liceSoPoprecenost: form.liceSoPoprecenost,
        formData: form,
        bratSestra,
        documents: allDocs,
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
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.toLowerCase().includes("insufficient") ||
        msg.toLowerCase().includes("0x1")
      ) {
        setTxError(
          "Nemashe dovolno SOL za gas. Zemi besplatni devnet SOL preku faucet.",
        );
      } else if (
        msg.toLowerCase().includes("user rejected") ||
        msg.toLowerCase().includes("cancelled")
      ) {
        setTxError("Ja otkazha transakcijata vo Phantom. Obidi se povtorno.");
      } else {
        setTxError(`Transakcijata ne uspea: ${msg}`);
      }
    } finally {
      setSending(false);
    }
  }

  // ── Success screen ──────────────────────────────────────────────────────────
  if (submitted || existingApp) {
    const displayHash = hash || existingApp?.hash || "";
    const displayTxSig = txSig || existingApp?.txSignature || "";
    const displayWallet = publicKey?.toBase58() ?? existingApp?.id ?? "-";
    const alreadyExisted = !submitted && !!existingApp;
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
          {alreadyExisted && (
            <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              Vekje imas podnesena prijava so ovoj wallet. Ne mozhesh da
              aplicirash dvapati.
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
            Prijavata e podnesena
          </h2>
          <p className="mb-1 text-sm text-gray-500">Tvojot anonimen ID:</p>
          <p className="mb-4 break-all rounded-lg bg-gray-100 px-3 py-2 font-mono text-xs text-gray-600">
            {displayWallet}
          </p>
          {displayHash && (
            <>
              <p className="mb-1 text-sm text-gray-500">SHA-256 hash:</p>
              <p className="mb-4 break-all rounded-lg bg-gray-100 px-3 py-2 font-mono text-xs text-indigo-700">
                {displayHash}
              </p>
            </>
          )}
          {displayTxSig && (
            <>
              <p className="mb-1 text-sm text-gray-500">Solana transakcija:</p>
              <p className="mb-3 break-all rounded-lg bg-gray-100 px-3 py-2 font-mono text-xs text-gray-600">
                {displayTxSig}
              </p>
              <a
                href={`https://explorer.solana.com/tx/${displayTxSig}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="mb-4 inline-block w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                Pogledni na Solana Explorer
              </a>
            </>
          )}
          <p className="mb-6 text-xs text-gray-400">
            Ovoj hash e zapisan na blockchain - nemenljiv dokaz.
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
            Resetiraj (Test Mode)
          </button>
        </div>
      </div>
    );
  }

  // ── Form ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto mt-5 max-w-2xl px-4">
        {!publicKey ? (
          <div className="flex items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            Povrzi go tvojot Phantom wallet pred da aplicirash.
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
            <span className="flex-1 truncate font-mono text-xs text-green-700">
              {publicKey.toBase58()}
            </span>
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-700">
              {scoring.total} poeni
            </span>
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="mx-auto mb-16 mt-6 flex max-w-2xl flex-col gap-5 px-4"
      >
        {/* Section 1 - Personal */}
        <SectionCard number="1" title="Lichni podatoci na kandidatot">
          <Row>
            <label>
              <FieldLabel>Ime</FieldLabel>
              <input
                type="text"
                name="ime"
                value={form.ime}
                onChange={handleChange}
                placeholder="pr. Marija"
                className={fieldClass}
              />
            </label>
            <label>
              <FieldLabel>Prezime</FieldLabel>
              <input
                type="text"
                name="prezime"
                value={form.prezime}
                onChange={handleChange}
                placeholder="pr. Ristovska"
                className={fieldClass}
              />
            </label>
          </Row>
          <Row>
            <label>
              <FieldLabel>Tatkovo Ime</FieldLabel>
              <input
                type="text"
                name="tatkovoIme"
                value={form.tatkovoIme}
                onChange={handleChange}
                placeholder="pr. Petar"
                className={fieldClass}
              />
            </label>
            <label>
              <FieldLabel>Pol</FieldLabel>
              <select
                name="pol"
                value={form.pol}
                onChange={handleChange}
                className={fieldClass}
              >
                <option value="">— izberete —</option>
                <option value="M">Mashki</option>
                <option value="Zh">Zhenski</option>
                <option value="D">Drugo</option>
              </select>
            </label>
          </Row>
          <Row>
            <label>
              <FieldLabel>EMBG</FieldLabel>
              <input
                type="text"
                name="embg"
                value={form.embg}
                onChange={handleChange}
                placeholder="1234567890123"
                maxLength={13}
                className={fieldClass}
              />
            </label>
            <label>
              <FieldLabel>Datum na raganje</FieldLabel>
              <input
                type="date"
                name="datumRaganje"
                value={form.datumRaganje}
                onChange={handleChange}
                className={fieldClass}
              />
            </label>
          </Row>
          <Row>
            <label>
              <FieldLabel>Pripadnost</FieldLabel>
              <input
                type="text"
                name="pripadnost"
                value={form.pripadnost}
                onChange={handleChange}
                placeholder="pr. Makedonec/ka"
                className={fieldClass}
              />
            </label>
            <label>
              <FieldLabel>Opstina na zhiveenje</FieldLabel>
              <input
                type="text"
                name="opstina"
                value={form.opstina}
                onChange={handleChange}
                placeholder="pr. Prilep"
                className={fieldClass}
              />
            </label>
          </Row>
          <label>
            <FieldLabel>Adresa na zhiveenje</FieldLabel>
            <input
              type="text"
              name="adresa"
              value={form.adresa}
              onChange={handleChange}
              placeholder="pr. ul. Marshal Tito 12"
              className={fieldClass}
            />
          </label>
        </SectionCard>

        {/* Section 2 - Tatko */}
        <SectionCard number="2" title="Podatoci za tatko-staratel">
          <Row>
            <label>
              <FieldLabel>Ime</FieldLabel>
              <input
                type="text"
                name="tatkoIme"
                value={form.tatkoIme}
                onChange={handleChange}
                placeholder="Petar"
                className={fieldClass}
              />
            </label>
            <label>
              <FieldLabel>Prezime</FieldLabel>
              <input
                type="text"
                name="tatkoPrezime"
                value={form.tatkoPrezime}
                onChange={handleChange}
                placeholder="Ristovski"
                className={fieldClass}
              />
            </label>
          </Row>
          <label>
            <FieldLabel>EMBG na tatko</FieldLabel>
            <input
              type="text"
              name="tatkoEmbg"
              value={form.tatkoEmbg}
              onChange={handleChange}
              placeholder="1234567890123"
              maxLength={13}
              className={fieldClass}
            />
          </label>
          <fieldset>
            <FieldLabel>Status na tatko-staratel</FieldLabel>
            <div className="flex flex-col gap-2">
              {(
                [
                  { value: "", label: "- ne e primenljivo -" },
                  { value: "nevraboten", label: "Tatko-staratel nevraboten" },
                  {
                    value: "nadomeshtok",
                    label:
                      "Tatko-staratel korisnik na nadomeshtok po osnov na prestanok na raboten odnos",
                  },
                  {
                    value: "pochinат",
                    label: "Tatko-staratel pochinat (+10 poeni)",
                  },
                ] as { value: string; label: string }[]
              ).map(({ value, label }) => (
                <label
                  key={value}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition ${
                    form.tatkoStatus === value && value !== ""
                      ? "border-indigo-300 bg-indigo-50 font-medium text-indigo-800"
                      : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <input
                    type="radio"
                    name="tatkoStatus"
                    value={value}
                    checked={form.tatkoStatus === value}
                    onChange={handleChange}
                    className="accent-indigo-600"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        </SectionCard>

        {/* Section 3 - Majka */}
        <SectionCard number="3" title="Podatoci za majka-staratel">
          <Row>
            <label>
              <FieldLabel>Ime</FieldLabel>
              <input
                type="text"
                name="majkaIme"
                value={form.majkaIme}
                onChange={handleChange}
                placeholder="Ana"
                className={fieldClass}
              />
            </label>
            <label>
              <FieldLabel>Prezime</FieldLabel>
              <input
                type="text"
                name="majkaPrezime"
                value={form.majkaPrezime}
                onChange={handleChange}
                placeholder="Ristovska"
                className={fieldClass}
              />
            </label>
          </Row>
          <label>
            <FieldLabel>EMBG na majka</FieldLabel>
            <input
              type="text"
              name="majkaEmbg"
              value={form.majkaEmbg}
              onChange={handleChange}
              placeholder="1234567890123"
              maxLength={13}
              className={fieldClass}
            />
          </label>
          <fieldset>
            <FieldLabel>Status na majka-staratel</FieldLabel>
            <div className="flex flex-col gap-2">
              {(
                [
                  { value: "", label: "- ne e primenljivo -" },
                  { value: "nevrabotena", label: "Majka-staratel nevrabotena" },
                  {
                    value: "nadomeshtok",
                    label:
                      "Majka-staratel korisnik na nadomeshtok po osnov na prestanok na raboten odnos",
                  },
                  {
                    value: "pochinata",
                    label: "Majka-staratel pochinata (+10 poeni)",
                  },
                ] as { value: string; label: string }[]
              ).map(({ value, label }) => (
                <label
                  key={value}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition ${
                    form.majkaStatus === value && value !== ""
                      ? "border-indigo-300 bg-indigo-50 font-medium text-indigo-800"
                      : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <input
                    type="radio"
                    name="majkaStatus"
                    value={value}
                    checked={form.majkaStatus === value}
                    onChange={handleChange}
                    className="accent-indigo-600"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        </SectionCard>

        {/* Section 4 - Brat/Sestra */}
        <SectionCard
          number="4"
          title="Podatoci za brat/sestra"
          badge={`${bratSestra.length} lica`}
        >
          {bratSestra.length === 0 && (
            <p className="text-sm text-gray-400">
              Nema dodadeni brakja/sestri.
            </p>
          )}
          {bratSestra.map((b, idx) => (
            <div
              key={idx}
              className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Brat/Sestra #{idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const next = bratSestra.filter((_, i) => i !== idx);
                    setBratSestra(next);
                    recomputeHash(form, next, namedDocs);
                  }}
                  className="text-xs text-gray-400 hover:text-red-500"
                >
                  Otstrani x
                </button>
              </div>
              <Row>
                <label>
                  <FieldLabel>Ime</FieldLabel>
                  <input
                    type="text"
                    value={b.ime}
                    onChange={(e) =>
                      setBratSestraField(idx, "ime", e.target.value)
                    }
                    placeholder="Ivan"
                    className={fieldClass}
                  />
                </label>
                <label>
                  <FieldLabel>Prezime</FieldLabel>
                  <input
                    type="text"
                    value={b.prezime}
                    onChange={(e) =>
                      setBratSestraField(idx, "prezime", e.target.value)
                    }
                    placeholder="Ristovski"
                    className={fieldClass}
                  />
                </label>
              </Row>
              <label>
                <FieldLabel>EMBG</FieldLabel>
                <input
                  type="text"
                  value={b.embg}
                  onChange={(e) =>
                    setBratSestraField(idx, "embg", e.target.value)
                  }
                  maxLength={13}
                  placeholder="1234567890123"
                  className={fieldClass}
                />
              </label>
              <fieldset>
                <FieldLabel>Status</FieldLabel>
                <div className="flex flex-col gap-2">
                  {(
                    [
                      {
                        value: "nevraboten",
                        label: "Brat/Sestra nevraboten/a",
                      },
                      {
                        value: "ucenik_student",
                        label: "Brat/Sestra ucenik/student (+3 poeni)",
                      },
                      {
                        value: "pod6god",
                        label: "Brat/Sestra vozrast pod 6 godini",
                      },
                      { value: "drug", label: "Imam drug/a brat/sestra" },
                    ] as { value: string; label: string }[]
                  ).map(({ value, label }) => (
                    <label
                      key={value}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition ${
                        b.status === value
                          ? "border-indigo-300 bg-indigo-50 font-medium text-indigo-800"
                          : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`bratSestra_${idx}_status`}
                        value={value}
                        checked={b.status === value}
                        onChange={(e) =>
                          setBratSestraField(idx, "status", e.target.value)
                        }
                        className="accent-indigo-600"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
              {b.status === "ucenik_student" && (
                <DocSlot
                  label="Potvrda za ucenik/student (PDF)"
                  required
                  file={bratSestraFiles[idx] ?? null}
                  onChange={(f) =>
                    setBratSestraFiles((prev) => ({ ...prev, [idx]: f }))
                  }
                />
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setBratSestra((prev) => [
                ...prev,
                { ime: "", prezime: "", embg: "", status: "" },
              ])
            }
            className="w-full rounded-lg border border-dashed border-indigo-300 bg-indigo-50 py-2.5 text-sm font-medium text-indigo-600 transition hover:bg-indigo-100"
          >
            + Dodadi brat/sestra
          </button>
        </SectionCard>

        {/* Section 5 - Dom */}
        <SectionCard number="5" title="Izbor na studentski dom">
          <label>
            <FieldLabel>Primaren studentski dom</FieldLabel>
            <select
              name="primerenDom"
              value={form.primerenDom}
              onChange={handleChange}
              className={fieldClass}
            >
              <option value="">— izberete —</option>
              {DOMOVI.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label>
            <FieldLabel>Alternativen studentski dom</FieldLabel>
            <select
              name="alternativenDom"
              value={form.alternativenDom}
              onChange={handleChange}
              className={fieldClass}
            >
              <option value="">— izberete (opcionalno) —</option>
              {DOMOVI.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label>
            <FieldLabel>Univerzitet</FieldLabel>
            <select
              name="univerzitet"
              value={form.univerzitet}
              onChange={handleChange}
              className={fieldClass}
            >
              <option value="">— izberete —</option>
              {UNIVERS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>
          <label>
            <FieldLabel>Fakultet / Studiska programa</FieldLabel>
            <input
              type="text"
              name="fakultet"
              value={form.fakultet}
              onChange={handleChange}
              placeholder="pr. Praven fakultet Justinijan Prvi"
              className={fieldClass}
            />
          </label>
        </SectionCard>

        {/* Section 6 - Academic */}
        <SectionCard number="6" title="Akademski uspeh" badge="do 35 poeni">
          <label>
            <FieldLabel>Prosechna ocenka od pretcodni godini</FieldLabel>
            <select
              name="prosecnaOcenka"
              value={form.prosecnaOcenka}
              onChange={handleChange}
              className={fieldClass}
            >
              <option value="">— izberete —</option>
              <option value="10">10.00</option>
              <option value="9.5">9.50 - 9.99</option>
              <option value="9">9.00 - 9.49</option>
              <option value="8.5">8.50 - 8.99</option>
              <option value="8">8.00 - 8.49</option>
              <option value="7.5">7.50 - 7.99</option>
              <option value="7">7.00 - 7.49</option>
              <option value="6.5">6.50 - 6.99</option>
              <option value="6">6.00 - 6.49</option>
            </select>
          </label>
          <Row>
            <label>
              <FieldLabel>Godina na studii</FieldLabel>
              <select
                name="godinaStudii"
                value={form.godinaStudii}
                onChange={handleChange}
                className={fieldClass}
              >
                <option value="">— izberete —</option>
                <option value="1">Prva godina (prv upisen)</option>
                <option value="2">Vtora godina</option>
                <option value="3">Treta godina</option>
                <option value="4">Chetverta godina</option>
                <option value="5">Petta+ godina</option>
              </select>
            </label>
            <label>
              <FieldLabel>Oddalechenost od dom (km)</FieldLabel>
              <select
                name="odalecenost"
                value={form.odalecenost}
                onChange={handleChange}
                className={fieldClass}
              >
                <option value="">— izberete —</option>
                <option value="101">Nad 100 km</option>
                <option value="75">51 - 100 km</option>
                <option value="40">31 - 50 km</option>
                <option value="25">21 - 30 km</option>
                <option value="15">11 - 20 km</option>
                <option value="5">Do 10 km / Skopje</option>
              </select>
            </label>
          </Row>
        </SectionCard>

        {/* Section 7 - Financial */}
        <SectionCard
          number="7"
          title="Materijalna sostojba na semejstvoto"
          badge="do 55 poeni"
        >
          <Row3>
            <label>
              <FieldLabel>Broj na chlenovi *</FieldLabel>
              <input
                type="number"
                name="brojClenovi"
                value={form.brojClenovi}
                onChange={handleChange}
                placeholder="pr. 4"
                min={1}
                className={fieldClass}
              />
            </label>
            <label>
              <FieldLabel>Studenti (bez kandidatot) *</FieldLabel>
              <input
                type="number"
                name="brojStudenti"
                value={form.brojStudenti}
                onChange={handleChange}
                placeholder="pr. 1"
                min={0}
                className={fieldClass}
              />
            </label>
            <label>
              <FieldLabel>Uchenici vo semejstvo *</FieldLabel>
              <input
                type="number"
                name="brojUcenici"
                value={form.brojUcenici}
                onChange={handleChange}
                placeholder="pr. 1"
                min={0}
                className={fieldClass}
              />
            </label>
          </Row3>
          <label>
            <FieldLabel>
              Tatko - mesechna neto plata / penzija / soc. pomosh (den.) *
            </FieldLabel>
            <input
              type="number"
              name="tatkoPlata"
              value={form.tatkoPlata}
              onChange={handleChange}
              placeholder="pr. 25000"
              className={fieldClass}
            />
          </label>
          <label>
            <FieldLabel>
              Majka - mesechna neto plata / penzija / soc. pomosh (den.) *
            </FieldLabel>
            <input
              type="number"
              name="majkaPlata"
              value={form.majkaPlata}
              onChange={handleChange}
              placeholder="pr. 18000"
              className={fieldClass}
            />
          </label>
          <label>
            <FieldLabel>
              Drugi vkupni neto mesechni primanja vo semejstvo *
            </FieldLabel>
            <input
              type="number"
              name="drugiPrimanja"
              value={form.drugiPrimanja}
              onChange={handleChange}
              placeholder="pr. 5000"
              className={fieldClass}
            />
          </label>
          {scoring.income > 0 && (
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-2.5 text-xs text-gray-500">
              Vkupen mesechен prihod:{" "}
              <strong className="text-gray-700">
                {scoring.income.toLocaleString()} den.
              </strong>{" "}
              / {Number(form.brojClenovi) || 1} chlena ={" "}
              <strong className="text-indigo-600">
                {Math.round(
                  scoring.income / (Number(form.brojClenovi) || 1),
                ).toLocaleString()}{" "}
                den./lice
              </strong>
            </div>
          )}
        </SectionCard>

        {/* Section 8 - Special */}
        <SectionCard
          number="8"
          title="Specijalni kategorii"
          badge="do +35 poeni"
        >
          {(
            [
              {
                name: "liceSoPoprecenost",
                label: "Kandidatot e lice so poprechenost (+10 poeni)",
              },
              {
                name: "branitelDete",
                label:
                  "Dete na zaginat/pochinat pripadnik na bezbednosni sili - braniteli (+5 poeni)",
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
          <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-xs text-indigo-700">
            <strong>Avtomatski presmetani bonusi:</strong>{" "}
            {scoring.pocinalEdenRoditel && "Pochinat eden roditel (+10) · "}
            {scoring.pocinaleDvajcaRoditeli &&
              "Pochinati dvajca roditeli (+20) · "}
            {scoring.dvajcaNeraboteni && "Dvajca nevraboteni roditeli (+5) · "}
            {!scoring.pocinalEdenRoditel &&
              !scoring.pocinaleDvajcaRoditeli &&
              !scoring.dvajcaNeraboteni &&
              "Popolnete sekcii 2 i 3 za avtomatski bonusi."}
          </div>
        </SectionCard>

        {/* Section 9 - Documents */}
        <SectionCard number="9" title="Zadolzhitelni dokumenti (PDF)">
          <div className="flex flex-col gap-2">
            {DOC_SLOTS.map(({ key, label, required }) => (
              <DocSlot
                key={key}
                label={label}
                required={required}
                file={namedDocs[key] ?? null}
                onChange={(f) => setNamedDoc(key, f)}
              />
            ))}
          </div>
        </SectionCard>

        {/* Live hash */}
        {hash && (
          <div className="rounded-xl border border-indigo-100 bg-white px-5 py-4">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">
              SHA-256 hash (live)
            </p>
            <p className="break-all font-mono text-xs text-indigo-600">
              {hash}
            </p>
            <p className="mt-2 text-xs text-gray-400">
              Promeni koe bilo pole - hashot ke se smeni celosno.
            </p>
          </div>
        )}

        {txError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {txError}
          </div>
        )}

        {/* Score preview */}
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
            Vkupni poeni (interno)
          </p>
          <p className="text-3xl font-bold text-indigo-600">{scoring.total}</p>
          <p className="mt-1 text-xs text-gray-400">
            Poenite ne se prikazuvaat na studentot - samo na rang listata.
          </p>
        </div>

        <button
          type="submit"
          disabled={!publicKey || sending}
          className="w-full rounded-xl bg-indigo-600 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sending
            ? "Prati potvrduvanje vo Phantom..."
            : publicKey
              ? "Podnesi prijava"
              : "Prvo povrzi wallet"}
        </button>
      </form>
    </div>
  );
}
