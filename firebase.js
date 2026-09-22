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

  async function loginUser({ email, password }) {
    if (!email || !password) {
      throw new Error("Email and password are required.");
    }

    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    return userCredential.user;
  }

  window.firebaseAuthAPI = {
    auth,
    db,
    signupUser,
    loginUser,
  };
})();
