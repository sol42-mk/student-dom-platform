# CLAUDE.md — Студентски Дом Платформа

## Што е ова?

Платформа за транспарентно аплицирање за студентски општини и стипендии во Македонија.
Целта е да се отстрани корупцијата при аплицирање преку:

- Анонимни апликации (Random ID = Phantom wallet адреса)
- Верификација на податоци од УЈП (Управа за јавни приходи)
- Запишување на хешови на Solana блокчејн (неменливи докази)
- МОН добива само анонимна ранг листа — не може да знае кој кој е пред да ја заклучи листата
- Де-анонимизација се случува САМО откако МОН ќе ја заклучи листата на Solana

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Blockchain**: Solana Devnet
- **Wallet**: Phantom (преку @solana/wallet-adapter)
- **On-chain**: Memo Program за запишување хешови (без custom smart contract)
- **State**: localStorage за демо (нема backend)

## Инсталирани пакети

```
@solana/web3.js
@solana/wallet-adapter-react
@solana/wallet-adapter-react-ui
@solana/wallet-adapter-wallets
@solana/wallet-adapter-base
```

## Структура на фајлови

```
app/
├── layout.tsx          — Root layout со Providers
├── providers.tsx       — WalletContextProvider (Devnet)
├── page.tsx            — Студент: форма за аплицирање
├── globals.css
├── ujp/
│   └── page.tsx        — УЈП верификатор интерфејс
├── dom/
│   └── page.tsx        — Студентски дом: преглед на документи
└── mon/
    └── page.tsx        — МОН: анонимна ранг листа + заклучување
```

## Целосен Flow

```
1. СТУДЕНТ (/student)
   - Поврзува Phantom wallet → wallet address = негов анонимен ID
   - Ги пополнува личните и финансиски податоци
   - Прикачува документи (за демо: само filename, без upload)
   - Системот пресметува поени автоматски
   - Стиска Поднеси → генерира SHA хеш од сите податоци
   - Хешот + статус SUBMITTED се запишуваат на Solana (Memo transaction)
   - Студентот НИКОГАШ не го знае неговиот ID (hash), само wallet address

2. УЈП (/ujp)
   - Гледа листа на апликации (wallet address + приходи за верификација)
   - Стиска Потврди или Одбие (со задолжителна причина ако одбие)
   - Потврдата се запишува на Solana → hash на верификацијата
   - Ако одбие, студентот добива 1-2 дена да го корегира

3. СТУДЕНТСКИ ДОМ (/dom)
   - Гледа документи на секоја апликација — ЕДЕН ПО ЕДЕН
   - Прифати или Одбие секој документ посебно
   - Одбивање = МОРА да внесе причина (без причина = не може да стисне)
   - Ако одбие 2 пати ист документ → автоматски FLAG → Пријава
   - Пријавата оди кај независен аудитор (во демо: AI проверка на причините)

4. АЛГОРИТАМ (автоматски)
   - По верификација, системот ги пресметува поените
   - Критериуми (види подолу)
   - Генерира ранг листа

5. МОН (/mon)
   - Гледа САМО: Анонимен ID (wallet) + Поени + Ранг
   - БЕЗ имиња, БЕЗ општини, БЕЗ факултет
   - Може само да ЗАКЛУЧИ листата (не може да менува редослед)
   - Заклучувањето е Solana трансакција — неменливо
   - ПОСЛЕ заклучувањето: де-анонимизација — имињата се прикажуваат

6. ИЗВЕСТУВАЊЕ
   - Секој студент добива: Примен (каде, кога) или Одбиен (зошто)
   - Причината за одбивање е јавна и запишана на блокчејн
```

## Критериуми за скорирање

| Критериум            | Поени | Логика                                 |
| -------------------- | ----- | -------------------------------------- |
| Приход по член       | 0–40  | <3000 МКД = 40 поени, >15000 = 4 поени |
| Членови на семејство | 0–15  | 6+ члена = 15, 2 члена = 3             |
| Академски просек     | 0–20  | Линеарно од 6.00 до 10.00              |
| Оддалеченост         | 0–15  | >100km = 15, Скопје = 0                |
| Починат родител      | +10   | Бонус                                  |
| Двајца починати      | +20   | Бонус                                  |
| Попреченост          | +10   | Бонус                                  |
| Бранители            | +5    | Бонус                                  |
| Невработени родители | +5    | Бонус                                  |

## Solana On-Chain логика

### Memo Program (нема Rust потребен)

```typescript
const MEMO_PROGRAM = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
);

// Формат на memo:
// STUDENTDOM:{hash}:{STATUS}
// Пример: STUDENTDOM:a3f2c9e1:SUBMITTED
// Пример: STUDENTDOM:a3f2c9e1:UJP_VERIFIED
// Пример: STUDENTDOM:a3f2c9e1:MON_LOCKED

const ix = new TransactionInstruction({
  keys: [{ pubkey: wallet, isSigner: true, isWritable: false }],
  programId: MEMO_PROGRAM,
  data: Buffer.from(`STUDENTDOM:${hash}:${status}`, "utf8"),
});
```

### Статуси на апликација

```
SUBMITTED       → Студентот поднел
UJP_VERIFIED    → УЈП потврдил
DOM_DOCS_OK     → Студентски дом прифатил документи
SCORED          → Алгоритамот пресметал поени
MON_LOCKED      → МОН ја заклучила листата
DEANONYMIZED    → Имињата се прикажани
```

## localStorage шема (за демо, без backend)

```typescript
// Клуч: 'applications'
// Вредност: Application[]

interface Application {
  id: string; // wallet address
  hash: string; // SHA хеш на податоците
  txSignature: string; // Solana transaction signature
  status: string; // SUBMITTED | UJP_VERIFIED | ...
  score: number; // Вкупни поени

  // Лични податоци (видливи само после де-анонимизација)
  name: string;
  surname: string;
  faculty: string;

  // Финансиски (видливи за УЈП)
  income: number;
  members: number;

  // Академски
  gpa: number;
  distance: number;

  // Документи (за демо: само имиња на фајлови)
  documents: {
    name: string;
    fileName: string;
    accepted?: boolean;
    reason?: string;
  }[];

  // Верификација
  ujpVerified?: boolean;
  ujpNote?: string;
  docsVerified?: boolean;
  flags?: string[]; // Пријави за сомнително одбивање

  // МОН
  monDecision?: "accepted" | "rejected";
  monReason?: string;
}
```

## Важни напомени за Claude Code

1. **Ова е DEMO** — нема вистински backend, нема вистински УЈП API. Сè е симулирано со localStorage.

2. **Wallet = Anonymous ID** — никогаш не прикажувај го вистинското ime/prezime на страните /ujp, /dom, /mon пред MON_LOCKED статус.

3. **Секое одбивање МОРА да има причина** — валидирај го ова на frontend пред да дозволиш submit.

4. **2× одбивање = FLAG** — ако еден документ е одбиен 2 пати, автоматски додај во `flags[]` и прикажи предупредување.

5. **Solana трансакции се на Devnet** — секогаш користи `clusterApiUrl('devnet')`. Никогаш mainnet.

6. **Memo формат** — секогаш `STUDENTDOM:{hash}:{STATUS}` за да можат да се пребаруваат на Explorer.

7. **Auto-confirm** — Phantom е поставен на auto-confirm на localhost, трансакциите нема да бараат рачна потврда.

8. **Tailwind** — користи Tailwind класи за стилизирање, не inline styles.

## Демо сценарио за презентација

```
1. Отвори /student → Поврзи Phantom
2. Пополни форма → Гледај live поени
3. Стисни Поднеси → Solana трансакција
4. Отвори explorer.solana.com/?cluster=devnet → Покажи трансакцијата
5. Отвори /ujp → Потврди апликацијата
6. Отвори /dom → Прифати документи (тестирај одбивање без причина)
7. Отвори /mon → Покажи анонимна листа → Заклучи → Де-анонимизација
8. Покажи дека МОН не можел да знае кој кој е пред заклучувањето
```

## Команди

```bash
npm run dev      # Локален сервер на localhost:3000
npm run build    # Production build
npm run lint     # TypeScript проверка
```

## Контакт / Хакатон

- Настан: Blockchain Hackathon — Base42, Скопје
- Организатор: Superteam Balkan
- Датум: 28 Април 2026
- Тема: Направете Македонија попотранспарентна и поправедна
