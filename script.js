/* ═══════════════════════════════════════════
   AI MEDICAL REPORT SUMMARIZER - INTERACTIONS
   ═══════════════════════════════════════════ */

// ── Navigation Toggle ──
const navToggle = document.querySelector('.nav-toggle');
const nav = document.getElementById('mainNav');

if (navToggle && nav) {
  navToggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });

  // Close nav when clicking a link
  nav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      nav.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

// ── Year ──
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// ── Smooth Header Background ──
const header = document.querySelector('.header');
if (header) {
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        if (window.scrollY > 50) {
          header.style.background = 'rgba(7, 11, 20, 0.92)';
          header.style.borderBottomColor = 'rgba(255, 255, 255, 0.08)';
        } else {
          header.style.background = 'rgba(7, 11, 20, 0.75)';
          header.style.borderBottomColor = 'rgba(255, 255, 255, 0.04)';
        }
        ticking = false;
      });
      ticking = true;
    }
  });
}

// ── Counter Animation ──
const counters = document.querySelectorAll('.count');

const animateCounter = (counter) => {
  const target = Number(counter.dataset.target);
  let current = 0;
  const duration = 2000; // ms
  const startTime = performance.now();

  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  const update = (currentTime) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easedProgress = easeOutCubic(progress);

    current = Math.round(target * easedProgress);

    // Format the display
    let suffix = '';
    if (target === 99) suffix = '%';
    if (target === 24) suffix = '/7';

    counter.textContent = `${current}${suffix}`;

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  };

  requestAnimationFrame(update);
};

// ── Scroll Reveal / Intersection Observer ──
const revealElements = document.querySelectorAll('.reveal-up, .reveal-right');
const statBoxes = document.querySelectorAll('.stat-box');
const securityPanel = document.querySelector('.security-panel');
const featuresImageWrap = document.querySelector('.features-image-wrap');

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        // Don't unobserve so animations can retrigger (optional)
        // revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
);

revealElements.forEach((el) => revealObserver.observe(el));

// Counter observer
const counterObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        counterObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.7 }
);

counters.forEach((counter) => counterObserver.observe(counter));

// Security panel bar animation
if (securityPanel) {
  const panelObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          panelObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.3 }
  );
  panelObserver.observe(securityPanel);
}

// Features image badges
if (featuresImageWrap) {
  const imgObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          imgObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.3 }
  );
  imgObserver.observe(featuresImageWrap);
}

// ── Hero trust counter animation ──
const trustCounters = document.querySelectorAll('.trust-item strong[data-count]');
trustCounters.forEach((el) => {
  const target = Number(el.dataset.count);
  const duration = 2000;
  const startTime = performance.now();

  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  const update = (currentTime) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easedProgress = easeOut(progress);
    const current = Math.round(target * easedProgress);
    el.textContent = `${current}K+`;

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  };

  // Start after hero animation
  setTimeout(() => requestAnimationFrame(update), 1200);
});

// ── Parallax effect on hero ──
const heroVisual = document.getElementById('heroVisual');
const heroBgImg = document.querySelector('.hero-bg-img');
if (heroVisual && window.innerWidth > 1024) {
  window.addEventListener('mousemove', (e) => {
    const x = (e.clientX / window.innerWidth - 0.5) * 2;
    const y = (e.clientY / window.innerHeight - 0.5) * 2;

    // Subtle parallax on background image
    if (heroBgImg) {
      heroBgImg.style.transform = `scale(1) translate(${x * 8}px, ${y * 5}px)`;
    }

    // Float cards move with mouse
    const floatCards = heroVisual.querySelectorAll('.hero-float-card');
    floatCards.forEach((card, i) => {
      const factor = (i + 1) * 5;
      card.style.transform = `translate(${x * factor}px, ${y * factor}px)`;
    });
  });
}

// ── Active nav link highlighting ──
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav a');

const navObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        navLinks.forEach((link) => {
          link.style.color = '';
          if (link.getAttribute('href') === `#${entry.target.id}`) {
            link.style.color = 'var(--primary)';
          }
        });
      }
    });
  },
  { threshold: 0.3, rootMargin: '-90px 0px 0px 0px' }
);

sections.forEach((section) => navObserver.observe(section));

// ── Smooth scroll for anchor links ──
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});
