# Matematikafeladatok

A local math and clock-reading practice app for 2nd grade elementary school children, with a Hungarian UI.

## Stack

- **Backend:** Node.js + Express
- **Frontend:** Vanilla HTML/CSS/JS (no build step)
- **Database:** SQLite via `better-sqlite3` (`history.db`, auto-created)
- **Port:** 3001

## Running

```bash
npm start
# → http://localhost:3001
```

## Features

### Setup screen (Beállítások)

Configure each session before starting:

| Setting | Description |
|---|---|
| Számtartomány | Min/max number range for +/− operands |
| Szorzótábla – legfeljebb | Max value for × and ÷ operands |
| Feladatok száma | Number of problems per session |
| Negatív eredmény | Allow/disallow negative answers |
| Tagok száma feladatonként | 2 terms only, or 2–3 terms per problem |

Settings persist in `localStorage`.

### Operations (Műveletek)

| Operation | Color | Notes |
|---|---|---|
| ➕ Összeadás | Green | Addition |
| ➖ Kivonás | Red | Subtraction |
| ✖️ Szorzás | Blue | Multiplication |
| ➗ Osztás | Yellow | Division; 2-clause only; remainders allowed via optional **Maradék** field |

### Clock modes (Óra)

| Mode | Description |
|---|---|
| Óra olvasás | Clock face with hands shown — user types the time (HH:MM) |
| Óra beállítás | Digital time shown — user drags clock hands to match |
| Óra szöveg | Hungarian text description (e.g. *"fél három előtt két perccel"*) — user drags clock hands to match |

**Clock interaction (Óra beállítás / Óra szöveg):**
1. Blank clock face shown
2. Click to place hour hand, drag to fine-tune → **Következő →**
3. Click to place minute hand, drag to fine-tune → **Kész ✓**
4. If both hands overlap when clicking, inline disambiguation appears: **[Óramutató] [Percmutató]**
5. Wrong answer resets to step 1

Tolerances: minute hand ±5°, hour hand ±10°

### Practice screen (Gyakorlás)

- One problem at a time, progress bar + counter (e.g. "3 / 10")
- **2 tries** per problem (shown as 2 dot indicators)
- Wrong answer: sad trombone sound (Web Audio API) + card shake animation
- Correct answer: ascending fanfare + canvas confetti explosion
- Operator signs colour-coded individually (not the whole card)

### Summary screen (Összegzés)

- Correct / wrong count for the session
- Table of all problems attempted

### History screen (Előzmények)

- All-time stats: total problems, correct (%), wrong
- Full table: problem, user answer, correct answer, tries, result, date
- Persisted in SQLite (`history.db`)

## Deployment notes

`better-sqlite3` is a native compiled module and SQLite is a local file — both are incompatible with Vercel's serverless/ephemeral filesystem.

**Recommended self-hosting options:**
- **Railway:** `railway up`, add a volume for the `history.db` file
- **Render:** "Web Service", start command `node server.js`, add persistent disk at `/data`, set db path to `/data/history.db`
