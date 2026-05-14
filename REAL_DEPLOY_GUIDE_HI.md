# HonestLink Real Google Login + Hosting Guide

## Important

`GOOGLE_CLIENT_SECRET` ko frontend project me kabhi save ya expose nahi karna chahiye.
Ye sirf secure server-side ya Google/Firebase Console setup ke liye hota hai.

Is project me real Google login ke liye aapko `GOOGLE_CLIENT_SECRET` code me use karne ki zaroorat nahi hai.
Firebase Authentication popup/redirect flow iske bina frontend se kaam karta hai.

## Real Google Login ke liye kya karna padega

### 1. Firebase Console me Google provider enable karo

- Firebase Console open karo
- `Authentication`
- `Sign-in method`
- `Google`
- `Enable`
- Save

### 2. Authorized domains add karo

`Authentication > Settings > Authorized domains` me ye domains add/check karo:

- `localhost`
- aapka hosting domain, jaise:
  - `gen-lang-client-0900595241.web.app`
  - `gen-lang-client-0900595241.firebaseapp.com`
- agar custom domain ho to woh bhi

### 3. Firebase web config valid honi chahiye

Current config file:

- [firebase-applet-config.json](/c:/Users/Asus/Downloads/linkedin/firebase-applet-config.json:1)

Ye app already isi file se Firebase initialize kar raha hai.

### 4. Firestore rules deploy karni hongi

Current rules file:

- [firestore.rules](/c:/Users/Asus/Downloads/linkedin/firestore.rules:1)

## Hosting ke liye ready files

Maine ye files add kar di hain:

- [firebase.json](/c:/Users/Asus/Downloads/linkedin/firebase.json:1)
- [.firebaserc](/c:/Users/Asus/Downloads/linkedin/.firebaserc:1)

## Deploy commands

Project build:

```powershell
npm install
npm run build
```

Firebase CLI install agar pehle se nahi hai:

```powershell
npm install -g firebase-tools
```

Login:

```powershell
firebase login
```

Hosting init usually ab zaroori nahi hoga kyunki `firebase.json` ready hai, but if needed:

```powershell
firebase use gen-lang-client-0900595241
```

Deploy hosting:

```powershell
firebase deploy --only hosting
```

Deploy Firestore rules:

```powershell
firebase deploy --only firestore:rules
```

## Real hosted URLs

Deploy ke baad app usually yahan milega:

- `https://gen-lang-client-0900595241.web.app`
- `https://gen-lang-client-0900595241.firebaseapp.com`

## Notes

- Demo shared API local network testing ke liye hai, real Firebase Hosting par woh Node script run nahi karegi.
- Real production use ke liye Firebase Auth + Firestore path hi primary working path hai.
- Real login ka main blocker code nahi, Firebase Console configuration hota hai.
