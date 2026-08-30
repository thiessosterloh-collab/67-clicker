// Firebase-backed global leaderboard. Loaded as an ES module (see the type="module"
// script tag in index.html) — exposes a plain window.Leaderboard object so the rest
// of the game (game.js, a classic script) can call into it like any other module.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged,
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const listeners = [];
onAuthStateChanged(auth, (user) => {
  listeners.forEach((cb) => cb(user));
});

// popup sign-in is unreliable on GitHub Pages (Cross-Origin-Opener-Policy interferes
// with the popup<->opener handshake Firebase relies on) — a full-page redirect avoids
// that entirely. getRedirectResult picks up the result when we land back here.
// This can also fail silently (resolve to null, no error) if the browser blocks
// cross-site storage access to the authDomain (Chrome storage partitioning, Safari
// ITP) — so report *both* outcomes, not just errors, so the game can show something
// concrete instead of leaving it ambiguous.
getRedirectResult(auth)
  .then((result) => {
    if (result && result.user) {
      console.log("Redirect sign-in completed:", result.user.displayName);
      window.dispatchEvent(new CustomEvent("leaderboard-signin-success", { detail: result.user }));
    } else {
      console.log("getRedirectResult: no pending redirect (normal on a plain page load).");
    }
  })
  .catch((e) => {
    console.error("Sign-in redirect failed:", e.code, e.message);
    window.dispatchEvent(new CustomEvent("leaderboard-signin-error", { detail: `${e.code || "error"}: ${e.message}` }));
  });

async function signInWithGoogle() {
  try {
    await signInWithRedirect(auth, new GoogleAuthProvider());
    return true;
  } catch (e) {
    console.error("Google sign-in failed:", e.code, e.message);
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
  signInWithGoogle,
  signOutUser,
  onAuthChange,
  getCurrentUser,
  submitScore,
  fetchLeaderboard,
};
// game.js is a classic (non-module) script, so it runs before this deferred module
// does — let it know once window.Leaderboard actually exists.
window.dispatchEvent(new CustomEvent("leaderboard-ready"));
