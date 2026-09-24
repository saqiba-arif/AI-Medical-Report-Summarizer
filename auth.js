document.addEventListener('DOMContentLoaded', () => {
  const authForms = document.querySelectorAll('.auth-form');

  // Detect page type from URL for reliable form detection
  const currentPage = window.location.pathname.split('/').pop().toLowerCase();
  const isLoginPage = currentPage === 'login.html' || currentPage === 'login';

  // Helper: Convert Firebase error codes to friendly messages
  function getFriendlyError(error) {
    const code = error.code || '';
    const map = {
      'auth/invalid-credential': 'Incorrect email or password. Please try again.',
      'auth/user-not-found': 'No account found with this email. Please sign up first.',
      'auth/wrong-password': 'Incorrect password. Please try again.',
      'auth/email-already-in-use': 'This email is already registered. Please login instead.',
      'auth/weak-password': 'Password is too weak. Use at least 6 characters.',
      'auth/invalid-email': 'Please enter a valid email address.',
      'auth/too-many-requests': 'Too many attempts. Please try again later.',
      'auth/network-request-failed': 'Network error. Please check your internet connection.',
      'auth/operation-not-allowed': 'Email/Password sign-in is not enabled. Please enable it in Firebase Console.',
    };
    return map[code] || error.message || 'Authentication failed. Please try again.';
  }

  authForms.forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const submitButton = form.querySelector('button[type="submit"]');
      if (!submitButton) return;

      const originalText = submitButton.textContent;
      submitButton.textContent = 'Processing...';
      submitButton.disabled = true;

      try {
        if (isLoginPage) {
          // ── LOGIN ──
          const email = document.getElementById('email')?.value.trim();
          const password = document.getElementById('password')?.value;

          if (!email || !password) {
            throw { code: 'auth/invalid-email', message: 'Email aur password dono zaroori hain.' };
          }

          if (!window.firebaseAuthAPI || !window.firebaseAuthAPI.loginUser) {
            throw new Error('Firebase login service is not available. Check your internet connection.');
          }

          const user = await window.firebaseAuthAPI.loginUser({ email, password });
          console.log('User logged in:', user.uid);

          // Redirect to dashboard on successful login
          window.location.href = 'dashboard.html';
          return;

        } else {
          // ── SIGN UP ──
          const firstName = document.getElementById('first-name')?.value.trim();
          const lastName = document.getElementById('last-name')?.value.trim();
          const email = document.getElementById('signup-email')?.value.trim();
          const password = document.getElementById('signup-password')?.value;

          if (!email || !password) {
            throw { code: 'auth/invalid-email', message: 'Email aur password dono zaroori hain.' };
          }

          if (!window.firebaseAuthAPI || !window.firebaseAuthAPI.signupUser) {
            throw new Error('Firebase signup service is not available. Check your internet connection.');
          }

          const user = await window.firebaseAuthAPI.signupUser({
            firstName,
            lastName,
            email,
            password,
          });

          console.log('User created:', user.uid);

          // Redirect to dashboard on successful signup
          window.location.href = 'dashboard.html';
          return;
        }

      } catch (error) {
        console.error('Auth error:', error);
        alert(getFriendlyError(error));
      } finally {
        submitButton.textContent = originalText;
        submitButton.disabled = false;
      }
    });
  });

  // ── SOCIAL LOGIN (Google & Microsoft) ──
  const googleBtns = document.querySelectorAll('#googleLoginBtn, .google-btn');
  googleBtns.forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const origHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span>Connecting...</span>';
      try {
        if (!window.firebaseAuthAPI || !window.firebaseAuthAPI.loginWithGoogle) {
          throw new Error('Google Sign-in service is not available. Please check connection.');
        }
        const user = await window.firebaseAuthAPI.loginWithGoogle();
        if (user) {
          console.log('Google login successful:', user.uid);
          window.location.href = 'dashboard.html';
        }
      } catch (err) {
        console.error('Google login error:', err);
        if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
          return;
        }
        if (err.code === 'auth/unauthorized-domain') {
          alert('Firebase Security Note: Domain (' + window.location.hostname + ') needs to be added in Firebase Console > Authentication > Settings > Authorized domains.');
          return;
        }
        alert(getFriendlyError(err));
      } finally {
        btn.innerHTML = origHtml;
        btn.disabled = false;
      }
    });
  });

  const microsoftBtns = document.querySelectorAll('#microsoftLoginBtn, .microsoft-btn');
  microsoftBtns.forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const origHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span>Connecting...</span>';
      try {
        if (!window.firebaseAuthAPI || !window.firebaseAuthAPI.loginWithMicrosoft) {
          throw new Error('Microsoft Sign-in service is not available. Please check connection.');
        }
        const user = await window.firebaseAuthAPI.loginWithMicrosoft();
        if (user) {
          console.log('Microsoft login successful:', user.uid);
          window.location.href = 'dashboard.html';
        }
      } catch (err) {
        console.error('Microsoft login error:', err);
        if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
          return;
        }
        if (err.code === 'auth/unauthorized-domain') {
          alert('Firebase Security Note: Domain (' + window.location.hostname + ') needs to be added in Firebase Console > Authentication > Settings > Authorized domains.');
          return;
        }
        alert(getFriendlyError(err));
      } finally {
        btn.innerHTML = origHtml;
        btn.disabled = false;
      }
    });
  });
});
