(function () {
  const firebaseConfig = {
    apiKey: "AIzaSyCSTzfjvFOwUD7noDNksmyX35cjAOAArZc",
    authDomain: "ai-medical-report-summarizer.firebaseapp.com",
    projectId: "ai-medical-report-summarizer",
    storageBucket: "ai-medical-report-summarizer.firebasestorage.app",
    messagingSenderId: "31293260759",
    appId: "1:31293260759:web:bdc0c87d82f65d3432c192",
    measurementId: "G-KS8SWEB63F",
  };

  if (typeof firebase === "undefined") {
    console.error("Firebase SDK is not loaded. Make sure the Firebase scripts are included before firebase.js.");
    window.firebaseAuthAPI = {
      auth: null,
      db: null,
      signupUser: async () => {
        throw new Error("Firebase SDK not loaded. Please add your Firebase scripts before firebase.js.");
      },
      loginUser: async () => {
        throw new Error("Firebase SDK not loaded. Please add your Firebase scripts before firebase.js.");
      },
    };
    return;
  }

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  const auth = firebase.auth();
  const db = firebase.firestore();

  async function signupUser({ firstName, lastName, email, password }) {
    if (!email || !password) {
      throw new Error("Email and password are required.");
    }

    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const user = userCredential.user;

    await db.collection("users").doc(user.uid).set({
      uid: user.uid,
      firstName: firstName || "",
      lastName: lastName || "",
      email: email.toLowerCase(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    return user;
  }

  async function saveUserRecord(user, extra = {}) {
    if (!user) return;
    try {
      const userRef = db.collection("users").doc(user.uid);
      const doc = await userRef.get();
      if (!doc.exists) {
        const nameParts = (user.displayName || "").split(" ");
        await userRef.set({
          uid: user.uid,
          firstName: extra.firstName || nameParts[0] || "",
          lastName: extra.lastName || nameParts.slice(1).join(" ") || "",
          email: (user.email || "").toLowerCase(),
          photoURL: user.photoURL || "",
          providerId: user.providerData && user.providerData[0] ? user.providerData[0].providerId : "google.com",
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      }
    } catch (e) {
      console.warn("Could not save user record to Firestore:", e);
    }
  }

  async function loginUser({ email, password }) {
    if (!email || !password) {
      throw new Error("Email and password are required.");
    }

    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    return userCredential.user;
  }

  async function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      const result = await auth.signInWithPopup(provider);
      await saveUserRecord(result.user);
      return result.user;
    } catch (error) {
      if (error.code === 'auth/popup-blocked') {
        return await auth.signInWithRedirect(provider);
      }
      throw error;
    }
  }

  async function loginWithMicrosoft() {
    const provider = new firebase.auth.OAuthProvider('microsoft.com');
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      const result = await auth.signInWithPopup(provider);
      await saveUserRecord(result.user);
      return result.user;
    } catch (error) {
      if (error.code === 'auth/popup-blocked') {
        return await auth.signInWithRedirect(provider);
      }
      throw error;
    }
  }

  // Handle redirect login response if page redirected back
  auth.getRedirectResult().then(async (result) => {
    if (result && result.user) {
      await saveUserRecord(result.user);
      window.location.href = 'dashboard.html';
    }
  }).catch((err) => {
    console.warn("Redirect sign-in note:", err);
  });

  window.firebaseAuthAPI = {
    auth,
    db,
    signupUser,
    loginUser,
    loginWithGoogle,
    loginWithMicrosoft,
  };
})();
