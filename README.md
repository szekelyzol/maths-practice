# Matek feladatok

A math and clock-reading practice app for 2nd grade elementary school children, with a Hungarian UI. Deployable as a static site.

## Stack

- **Frontend:** Vanilla HTML/CSS/JS (no build step)
- **Local dev server:** Node.js + Express (static file serving only)
- **Port:** 3001

## Running locally

```bash
npm start
# → http://localhost:3001
```

## Deployment

The app is a pure static site deployed to Vercel. Check it out here: https://maths-practice-game.vercel.app/

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

### Operations (Műveletek)

| Operation | Color | Notes |
|---|---|---|
| ➕ Összeadás | Green | Addition |
| ➖ Kivonás | Red | Subtraction |
| ✖️ Szorzás | Blue | Multiplication |
| ➗ Osztás | Yellow | Division; 2-clause only; optional **Maradék** (remainder) field |
| ⚖ Reláció | Pink | Relation: user picks `<`, `=`, or `>` between an expression and a number |

### Clock modes (Óra)

| Mode | Description |
|---|---|
| Óra olvasás | Clock face with hands shown — user types the time (HH:MM) |
| Óra beállítás | Digital time shown — user drags clock hands to match |
| Óra szöveg | Hungarian text description (e.g. *"fél három előtt két perccel"*) — user drags clock hands to match |

**Clock interaction (Óra beállítás / Óra szöveg):**

Both hands start pre-placed at 13:00. Drag either hand to the correct position, then press **Kész ✓**. The hands are linked like a real clock — dragging the minute hand moves the hour hand at 1/12 speed, and vice versa. When hands overlap, the minute hand is grabbed by default.

Tolerances: minute hand ±5°, hour hand ±10°

### Practice screen (Gyakorlás)

- One problem at a time, progress bar + counter (e.g. "3 / 10")
- **2 tries** per problem (shown as 2 dot indicators)
- Wrong answer: sad trombone sound (Web Audio API) + card shake animation
- Correct answer: ascending fanfare + canvas confetti explosion
- Operator signs colour-coded individually

### Summary screen (Összegzés)

- Correct / wrong count for the session
- Full table of all problems attempted
