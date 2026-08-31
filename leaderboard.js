// Firebase-backed global leaderboard. Loaded as an ES module (see the type="module"
// script tag in index.html) — exposes a plain window.Leaderboard object so the rest
// of the game (game.js, a classic script) can call into it like any other module.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithCredential, signInAnonymously, updateProfile, signOut, onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, collection, query, orderBy, limit, getDocs, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCQLmFwLw1bqXRy4ODGuu2fulT6BETnm4g",
  authDomain: "clicker-284f6.firebaseapp.com",
  projectId: "clicker-284f6",
  storageBucket: "clicker-284f6.firebasestorage.app",
  messagingSenderId: "570318259969",
  appId: "1:570318259969:web:b9727b99562c7a8dbbbd00",
  measurementId: "G-2D7041D9B9",
};
// the same OAuth client Firebase auto-created for this project's Google provider
const GOOGLE_CLIENT_ID = "570318259969-4nmjdgoc05ed6q66rdl55gqnv166to96.apps.googleusercontent.com";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const listeners = [];
onAuthStateChanged(auth, (user) => {
  listeners.forEach((cb) => cb(user));
});

// Both signInWithPopup and signInWithRedirect turned out to be unreliable here:
// popups fight with Cross-Origin-Opener-Policy, and redirect can silently come back
// with no result at all if the browser blocks the storage access Firebase needs to
// correlate the returned auth state (a real, known limitation, not a code bug).
// Google Identity Services (GSI) sidesteps both — it runs its own sign-in flow via
// an iframe/FedCM directly on this page and just hands back an ID token, which we
// then exchange for a Firebase credential. No popup, no redirect, no cross-site
// storage read required.
function handleGoogleCredential(response) {
  const credential = GoogleAuthProvider.credential(response.credential);
  signInWithCredential(auth, credential)
    .then((result) => {
      window.dispatchEvent(new CustomEvent("leaderboard-signin-success", { detail: result.user }));
    })
    .catch((e) => {
      console.error("Firebase sign-in with Google credential failed:", e.code, e.message);
      window.dispatchEvent(new CustomEvent("leaderboard-signin-error", { detail: `${e.code || "error"}: ${e.message}` }));
    });
}

function initGoogleSignIn(attempt) {
  attempt = attempt || 0;
  if (!(window.google && window.google.accounts && window.google.accounts.id)) {
    if (attempt > 40) {
      // ~10s of retrying and the GSI script still hasn't loaded — likely blocked
      window.dispatchEvent(new CustomEvent("leaderboard-signin-error", { detail: "Google Sign-In script failed to load (ad blocker?)." }));
      return;
    }
    setTimeout(() => initGoogleSignIn(attempt + 1), 250);
    return;
  }
  window.google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleGoogleCredential,
  });
  const container = document.getElementById("google-signin-container");
  if (container) {
    window.google.accounts.id.renderButton(container, {
      theme: "filled_blue",
      size: "large",
      shape: "pill",
      text: "signin_with",
    });
  }
}
initGoogleSignIn();

// Temporary stopgap while Google sign-in gets sorted out: a name-only entry,
// backed by Firebase Anonymous Auth. Not a verified identity — anyone can type
// any name — so it's flagged (user.isAnonymous, stored and shown as unverified)
// rather than presented the same as a real Google-verified sign-in.
async function signInWithName(name) {
  const trimmed = (name || "").trim().slice(0, 24) || "Guest Flyer";
  try {
    let user = auth.currentUser;
    if (!user || !user.isAnonymous) {
      const cred = await signInAnonymously(auth);
      user = cred.user;
    }
    await updateProfile(user, { displayName: trimmed });
    // updateProfile doesn't itself re-fire onAuthStateChanged, so push the
    // now-updated user to listeners manually
    listeners.forEach((cb) => cb(auth.currentUser));
    window.dispatchEvent(new CustomEvent("leaderboard-signin-success", { detail: { displayName: trimmed, photoURL: null } }));
    return true;
  } catch (e) {
    console.error("Name sign-in failed:", e.code, e.message);
    window.dispatchEvent(new CustomEvent("leaderboard-signin-error", { detail: `${e.code || "error"}: ${e.message}` }));
    return false;
  }
}

async function signOutUser() {
  await signOut(auth);
}

function onAuthChange(cb) {
  listeners.push(cb);
  cb(auth.currentUser);
}

function getCurrentUser() {
  return auth.currentUser;
}

async function submitScore(data) {
  const user = auth.currentUser;
  if (!user) return false;
  try {
    await Promise.race([
      setDoc(
        doc(db, "leaderboard", user.uid),
        {
          name: user.displayName || "Anonymous Flyer",
          photoURL: user.photoURL || null,
          isAnonymous: !!user.isAnonymous,
          bestDistance: data.bestDistance,
          bestVelocity: data.bestVelocity,
          achievementsCount: data.achievementsCount,
          systemsPassed: data.systemsPassed,
          engineLevel: data.engineLevel,
          rebirths: data.rebirths || 0,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      ),
      timeout(8000),
    ]);
    return true;
  } catch (e) {
    console.error("Leaderboard submit failed:", e.message);
    return false;
  }
}

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error("timed out")), ms));
}

async function fetchLeaderboard(topN) {
  try {
    const q = query(collection(db, "leaderboard"), orderBy("bestDistance", "desc"), limit(topN || 50));
    const snap = await Promise.race([getDocs(q), timeout(8000)]);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error("Leaderboard fetch failed:", e.message);
    return [];
  }
}

window.Leaderboard = {
  signInWithName,
  signOutUser,
  onAuthChange,
  getCurrentUser,
  submitScore,
  fetchLeaderboard,
};
// game.js is a classic (non-module) script, so it runs before this deferred module
// does — let it know once window.Leaderboard actually exists.
window.dispatchEvent(new CustomEvent("leaderboard-ready"));
