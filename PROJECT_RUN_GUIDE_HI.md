# HonestLink Project Guide

## 1. Project kya hai

HonestLink ek React + Vite + Firebase based web app hai jahan users apni career-related honest posts share kar sakte hain.

## 2. Main features

- Google login se sign in
- Feed me honest career posts dekhna
- Post categories: `rant`, `tip`, `interview`, `review`, `salary`
- Salary transparency aur workplace reviews
- Burnout aur interview experiences share karna
- Like button ke through engagement
- Firestore se real-time post updates

## 3. Project kis tech stack par bana hai

- React 19
- TypeScript
- Vite
- Firebase Auth
- Firebase Firestore
- Tailwind CSS
- Motion animations

## 4. Terminal commands to run

PowerShell me project folder ke andar ye commands chalani hain:

```powershell
npm install
```

`.env.local` file banao aur Groq key add karo:

```env
GROQ_API_KEY=your_groq_api_key_here
```

Phir dev server run karo:

```powershell
npm run dev
```

Browser me open karo:

```text
http://localhost:3000
```

## 5. Important note

App me Firebase config already `firebase-applet-config.json` se load ho raha hai. Google login aur Firestore use karne ke liye Firebase project configuration valid honi chahiye.

Manual API key file path:

```text
c:\Users\Asus\Downloads\linkedin\.env.local
```

## 6. Build command

Production build ke liye:

```powershell
npm run build
```

Preview ke liye:

```powershell
npm run preview
```
