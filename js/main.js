/* ==========================================================================
   rohal.dev — behaviour
   Vanilla JS + GSAP/ScrollTrigger. Everything runs inside one IIFE so the
   sections below can share helpers. Rough order:
     smooth scroll -> loader/boot -> titles -> cursor -> reveals -> sections
     (metrics, work, stack, journey, contact) -> overlays (palette, terminal,
     chat, game) -> sound -> v13 additions (Bit dock, journey Bit, build log,
     secret room).
   ========================================================================== */

(function () {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  gsap.registerPlugin(ScrollTrigger);

  /* SMOOTH SCROLL */
  const smoothContent = document.getElementById('smooth-content');
  const velocityTrack = document.getElementById('velocityTrack');
  let currentScroll = 0,
    targetScroll = 0,
    prevScrollForVelocity = 0,
    skewCurrent = 0,
    vTrackOffset = 0;
  /* ---- layout cache ----------------------------------------------------
     Positions are measured only when layout actually changes (load, resize,
     the page growing or shrinking), never inside the per-frame loop. Reading
     offsetTop / scrollHeight / scrollWidth on every frame forced a full
     reflow each tick, which was the main cause of scroll jank. */
  const sectionEls = Array.from(document.querySelectorAll('section[id]'));
  const layout = { docMax: 0, heroH: 600, heroTop: 0, vWrap: 1, tops: [] };
  let spotKick = null; // set by the cursor-spotlight block further down
  const COARSE = window.matchMedia('(pointer:coarse)').matches;
  const rootEl = document.documentElement;
  function measureLayout() {
    layout.docMax = Math.max(0, rootEl.scrollHeight - rootEl.clientHeight);
    const hero = document.getElementById('hero');
    layout.heroH = hero ? hero.offsetHeight : 600;
    layout.heroTop = hero ? hero.offsetTop : 0;
    layout.vWrap = velocityTrack ? velocityTrack.scrollWidth / 3 || 1 : 1;
    layout.tops = sectionEls.map((s) => s.offsetTop);
  }
  function setBodyHeight() {
    document.body.style.height = smoothContent.offsetHeight + 'px';
    measureLayout();
  }
  window.addEventListener('resize', setBodyHeight);
  setTimeout(setBodyHeight, 50);
  setTimeout(setBodyHeight, 700);
  window.addEventListener('load', () => setTimeout(setBodyHeight, 300));
  if ('ResizeObserver' in window) {
    let roRaf = 0;
    new ResizeObserver(() => {
      cancelAnimationFrame(roRaf);
      roRaf = requestAnimationFrame(setBodyHeight);
    }).observe(smoothContent);
  }

  /* the marquee banner only needs to move while it is on screen */
  let vtVisible = true;
  if (velocityTrack && 'IntersectionObserver' in window) {
    new IntersectionObserver((en) => (vtVisible = en[0].isIntersecting), { rootMargin: '200px' }).observe(
      velocityTrack.parentElement || velocityTrack,
    );
  }

  let lastSpotScroll = NaN,
    lastScrollWritten = NaN,
    lastSkewWritten = NaN,
    lastSTScroll = NaN;
  function smoothLoop() {
    targetScroll = window.scrollY || window.pageYOffset || 0;
    /* touch devices already have native momentum; a second lerp on top only adds latency */
    const instant = reduceMotion || COARSE || rootEl.classList.contains('lite');
    const ease = instant ? 1 : 0.12;
    currentScroll += (targetScroll - currentScroll) * ease;
    if (Math.abs(targetScroll - currentScroll) < 0.05) currentScroll = targetScroll;

    const velocity = currentScroll - prevScrollForVelocity;
    prevScrollForVelocity = currentScroll;

    const targetSkew = instant ? 0 : Math.max(-1.6, Math.min(1.6, velocity * -0.14));
    skewCurrent += (targetSkew - skewCurrent) * 0.15;
    if (Math.abs(skewCurrent) < 0.005) skewCurrent = 0;
    if (currentScroll !== lastScrollWritten || skewCurrent !== lastSkewWritten) {
      lastScrollWritten = currentScroll;
      lastSkewWritten = skewCurrent;
      smoothContent.style.transform =
        skewCurrent === 0
          ? `translate3d(0, ${-currentScroll}px, 0)`
          : `translate3d(0, ${-currentScroll}px, 0) skewY(${skewCurrent.toFixed(3)}deg)`;
    }

    if (velocityTrack && vtVisible) {
      const boost = Math.min(7, Math.abs(velocity) * 0.9);
      vTrackOffset += (reduceMotion ? 0.3 : 0.6) + boost;
      velocityTrack.style.transform = `translateX(${-(vTrackOffset % layout.vWrap)}px)`;
    }

    if (currentScroll !== lastSTScroll) {
      lastSTScroll = currentScroll;
      ScrollTrigger.update();
    }
    tickNav();
    if (spotKick && currentScroll !== lastSpotScroll) {
      lastSpotScroll = currentScroll;
      spotKick();
    }
    requestAnimationFrame(smoothLoop);
  }
  requestAnimationFrame(smoothLoop);
  ScrollTrigger.scrollerProxy(document.body, {
    scrollTop(value) {
      if (arguments.length) {
        currentScroll = targetScroll = value;
        window.scrollTo(0, value);
      }
      return targetScroll;
    },
    getBoundingClientRect() {
      return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
    },
    pinType: 'transform',
  });

  /* LOADER */
  const loader = document.getElementById('loader');
  const panelTop = document.getElementById('panelTop');
  const panelBottom = document.getElementById('panelBottom');
  const loaderName = document.getElementById('loaderName');
  loaderName.innerHTML = loaderName.textContent
    .split('')
    .map((ch) => `<span>${ch === ' ' ? '&nbsp;' : ch}</span>`)
    .join('');

  function playHeroIntro() {
    gsap.fromTo(
      '.hey-card',
      { opacity: 0, y: 30, rotate: -2 },
      { opacity: 1, y: 0, rotate: 0, duration: 0.9, ease: 'power4.out' },
    );
    gsap.fromTo(
      '.hero-actions',
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.8, delay: 0.3, ease: 'power3.out' },
    );
    gsap.fromTo(
      '.code-window',
      { opacity: 0, y: 30, rotate: 8 },
      { opacity: 1, y: 0, rotate: 2, duration: 1, delay: 0.2, ease: 'power4.out' },
    );
    ScrollTrigger.refresh();
    window.__heroPlayed = true;
    if (window.__heroReady) window.__heroReady();
  }
  function runLoader() {
    const log = document.getElementById('bootLog'),
      bar = document.getElementById('bootBar'),
      pct = document.getElementById('bootPct');
    const seen = (function () {
      try {
        return sessionStorage.getItem('rk-booted');
      } catch (e) {
        return null;
      }
    })();
    const L = [
      ['BIOS', 'rohal.dev firmware v13', 'OK', 'ok'],
      ['mount', '/projects /stack /journey', 'OK', 'ok'],
      ['load', 'react node django claude-api', 'OK', 'ok'],
      ['attach', 'bit.sys (friendly robot)', 'OK', 'ok'],
      ['check', 'coffee levels', 'LOW', 'warn'],
      ['start', 'portfolio.service', 'READY', 'ok'],
    ];
    const tl = gsap.timeline({ defaults: { ease: 'none' } });
    const step = seen ? 0.12 : 0.3;
    L.forEach((l, i) => {
      tl.add(() => {
        const d = document.createElement('div');
        d.innerHTML =
          '<span class="dim">[' +
          String(i + 1).padStart(2, '0') +
          ']</span> ' +
          l[0].padEnd(7, ' ') +
          ' ' +
          l[1].padEnd(30, '.') +
          ' <span class="' +
          l[3] +
          '">' +
          l[2] +
          '</span>';
        log.appendChild(d);
        gsap.to(d, { opacity: 1, duration: 0.12 });
        if (window.__sfx) window.__sfx.tick();
      }, i * step);
      tl.to(bar, { width: ((i + 1) / L.length) * 100 + '%', duration: step * 0.9 }, i * step);
      tl.to(
        { v: 0 },
        {
          v: 1,
          duration: step * 0.9,
          onUpdate: function () {
            pct.textContent = Math.round(parseFloat(bar.style.width) || 0) + '%';
          },
        },
        i * step,
      );
    });
    tl.to('#boot', { opacity: 0, y: -14, duration: 0.3, ease: 'power2.in' }, '+=.35')
      .to('.boot-skip', { opacity: 0, duration: 0.2 }, '<')
      .to(
        [panelTop, panelBottom],
        { duration: 0.75, ease: 'power4.inOut', y: (i) => (i === 0 ? '-100%' : '100%') },
        '-=.05',
      )
      .set(loader, { display: 'none' })
      .set([panelTop, panelBottom], { display: 'none' })
      .add(() => {
        try {
          sessionStorage.setItem('rk-booted', '1');
        } catch (e) {}
        playHeroIntro();
      });
    const skip = () => {
      tl.timeScale(9);
      window.removeEventListener('keydown', skip);
      loader.removeEventListener('pointerdown', skip);
    };
    window.addEventListener('keydown', skip);
    loader.addEventListener('pointerdown', skip);
  }
  if (reduceMotion) {
    loader.style.display = 'none';
    panelTop.style.display = 'none';
    panelBottom.style.display = 'none';
    playHeroIntro();
  } else {
    runLoader();
  }

  /* KINETIC TITLES */
  function splitWords(el) {
    const nodes = Array.from(el.childNodes);
    el.innerHTML = '';
    nodes.forEach((node) => {
      if (node.nodeType === 3) {
        node.textContent.split(/(\s+)/).forEach((part) => {
          if (part.trim() === '') {
            el.appendChild(document.createTextNode(part));
            return;
          }
          const outer = document.createElement('span');
          outer.className = 'word-outer';
          const inner = document.createElement('span');
          inner.style.display = 'inline-block';
          inner.textContent = part;
          outer.appendChild(inner);
          el.appendChild(outer);
        });
      } else if (node.tagName === 'BR') {
        el.appendChild(node);
      } else {
        const outer = document.createElement('span');
        outer.className = 'word-outer';
        const inner = document.createElement('span');
        inner.style.display = 'inline-block';
        inner.appendChild(node);
        outer.appendChild(inner);
        el.appendChild(outer);
      }
    });
    return el.querySelectorAll('.word-outer > span');
  }
  document.querySelectorAll('.section-title.kinetic').forEach((title) => {
    const words = splitWords(title);
    gsap.set(words, { yPercent: 110, rotate: 4 });
    ScrollTrigger.create({
      trigger: title,
      scroller: document.body,
      start: 'top 85%',
      onEnter: () =>
        gsap.to(words, { yPercent: 0, rotate: 0, duration: 0.9, stagger: 0.045, ease: 'power4.out' }),
    });
  });

  /* CURSOR */
  const canHover = window.matchMedia('(hover:hover)').matches;
  if (canHover) {
    document.body.classList.add('has-cursor');
    const dot = document.getElementById('cursorDot'),
      ring = document.getElementById('cursorRing'),
      label = document.getElementById('cursorLabel');
    const xTo = gsap.quickTo(ring, 'x', { duration: 0.3, ease: 'power3' }),
      yTo = gsap.quickTo(ring, 'y', { duration: 0.3, ease: 'power3' });
    window.addEventListener('mousemove', (e) => {
      dot.style.left = e.clientX + 'px';
      dot.style.top = e.clientY + 'px';
      xTo(e.clientX);
      yTo(e.clientY);
    });
    document.addEventListener('mouseover', (e) => {
      const el = e.target.closest(
        '[data-magnetic], a, button, .node, .metric-card, .work-card, .stack-panel',
      );
      if (el) {
        ring.classList.add('active');
        dot.classList.add('hot');
        label.textContent = el.dataset.cursor || '';
      }
    });
    window.addEventListener('mousedown', (e) => {
      dot.classList.add('down');
      if (reduceMotion) return;
      for (let i = 0; i < 7; i++) {
        const p = document.createElement('i');
        p.className = 'cursor-spark';
        p.style.left = e.clientX + 'px';
        p.style.top = e.clientY + 'px';
        document.body.appendChild(p);
        const a = (Math.PI * 2 * i) / 7 + Math.random() * 0.5,
          d = 26 + Math.random() * 26;
        gsap.fromTo(
          p,
          { x: 0, y: 0, rotate: 0, opacity: 1 },
          {
            x: Math.cos(a) * d,
            y: Math.sin(a) * d,
            rotate: 180,
            opacity: 0,
            duration: 0.5,
            ease: 'power2.out',
            onComplete: () => p.remove(),
          },
        );
      }
    });
    window.addEventListener('mouseup', () => dot.classList.remove('down'));
    document.addEventListener('mouseout', (e) => {
      const el = e.target.closest(
        '[data-magnetic], a, button, .node, .metric-card, .work-card, .stack-panel',
      );
      if (el) {
        ring.classList.remove('active');
        dot.classList.remove('hot');
        label.textContent = '';
      }
    });
  }

  /* MAGNETIC */
  if (canHover && !reduceMotion) {
    document.querySelectorAll('[data-magnetic]').forEach((el) => {
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2,
          y = e.clientY - r.top - r.height / 2;
        gsap.to(el, { x: x * 0.18, y: y * 0.28, duration: 0.4, ease: 'power3.out' });
      });
      el.addEventListener('mouseleave', () =>
        gsap.to(el, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1,0.4)' }),
      );
    });
  }

  /* REVEAL */
  document.querySelectorAll('.reveal, .reveal-stagger').forEach((el) => {
    ScrollTrigger.create({
      trigger: el,
      scroller: document.body,
      start: 'top 88%',
      onEnter: () => el.classList.add('in'),
    });
  });

  /* COUNT UP — scroll-scrubbed, not one-shot: numbers track scroll position and rewind if you scroll back up */
  document.querySelectorAll('.count').forEach((el) => {
    const target = parseFloat(el.dataset.target),
      suffix = el.dataset.suffix || '';
    const obj = { v: 0 };
    gsap.to(obj, {
      v: target,
      ease: 'none',
      onUpdate: () => {
        el.textContent = Math.round(obj.v) + suffix;
      },
      scrollTrigger: { trigger: el, scroller: document.body, start: 'top 92%', end: 'top 40%', scrub: 0.6 },
    });
  });

  /* GOLD TOGGLE (persisted) */
  const goldSwitch = document.getElementById('goldSwitch');
  function setGoldMode(on) {
    document.documentElement.classList.toggle('gold-mode', on);
    goldSwitch.classList.toggle('on', on);
    goldSwitch.setAttribute('aria-checked', on ? 'true' : 'false');
    try {
      localStorage.setItem('rk-gold-mode', on ? '1' : '0');
    } catch (e) {}
  }
  try {
    if (localStorage.getItem('rk-gold-mode') === '1') setGoldMode(true);
  } catch (e) {}
  goldSwitch.addEventListener('click', () =>
    setGoldMode(!document.documentElement.classList.contains('gold-mode')),
  );
  goldSwitch.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      goldSwitch.click();
    }
  });

  /* TOP MARQUEE BAR */
  const topMessages = [
    '☕ FUELED BY CHAI',
    '🐛 PROBABLY FIXING A BUG RIGHT NOW',
    '🌍 OPEN TO REMOTE ROLES',
    '⚡ SHIPS FAST, BREAKS RARELY',
    '🎧 CODING WITH HEADPHONES ON',
    '🔥 90% FASTER INCIDENT DIAGNOSIS',
  ];
  const topBarTrack = document.getElementById('topBarTrack');
  const topBarHtml = topMessages.map((m) => `<span>${m}</span>`).join('');
  topBarTrack.innerHTML = topBarHtml + topBarHtml;

  /* SCATTERED CORKBOARD + FLY-IN REVEAL */
  document.querySelectorAll('.gh-card, .stack-panel').forEach((el, i) => {
    el.style.setProperty('--r', (Math.random() * 6 - 3).toFixed(2) + 'deg');
    const dir = i % 2 === 0 ? -60 : 60;
    el.style.setProperty('--fx', dir + 'px');
    el.style.opacity = 0;
    ScrollTrigger.create({
      trigger: el,
      scroller: document.body,
      start: 'top 90%',
      once: true,
      onEnter: () => gsap.to(el, { '--fx': '0px', opacity: 1, duration: 0.85, ease: 'power4.out' }),
    });
  });

  /* WORK CARDS FLY-IN — opacity only; the coverflow effect below owns `transform` on these elements exclusively */
  document.querySelectorAll('.work-card').forEach((el, i) => {
    gsap.set(el, { opacity: 0 });
    ScrollTrigger.create({
      trigger: el,
      scroller: document.body,
      start: 'top 92%',
      once: true,
      onEnter: () => gsap.to(el, { opacity: 1, duration: 0.7, ease: 'power2.out', delay: i * 0.06 }),
    });
  });

  /* VELOCITY-DRIVEN GIANT MARQUEE (content only — motion is driven by the smooth-scroll loop above) */
  const velocityWords = ['SHIP', '✦', 'OBSERVE', '✦', 'ITERATE', '✦', 'REPEAT', '✦'];
  if (velocityTrack) {
    const vHtml = velocityWords.map((w) => `<span${w === '✦' ? ' class="hollow"' : ''}>${w}</span>`).join('');
    velocityTrack.innerHTML = vHtml + vHtml + vHtml;
  }

  /* READY-TO-BUILD ARC TEXT SCRUB */
  const readySvg = document.querySelector('.ready-svg text');
  if (readySvg) {
    gsap.fromTo(
      readySvg,
      { scale: 0.7, opacity: 0.3 },
      {
        scale: 1,
        opacity: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: '.ready-wrap',
          scroller: document.body,
          start: 'top 90%',
          end: 'top 30%',
          scrub: true,
        },
      },
    );
  }

  /* HOW-I-BUILD CONVEYOR — cards slide in from the right, staggered progressively down the section */
  document.querySelectorAll('.build-step').forEach((el, i) => {
    gsap.fromTo(
      el,
      { opacity: 0, x: 90 },
      {
        opacity: 1,
        x: 0,
        ease: 'none',
        scrollTrigger: {
          trigger: '#buildGrid',
          scroller: document.body,
          start: `top ${85 - i * 10}%`,
          end: `top ${55 - i * 10}%`,
          scrub: 0.5,
        },
      },
    );
  });

  /* HERO EXIT PARALLAX — scale-only, so it never fights the load-in entrance timeline's opacity/y/rotate tweens */
  gsap.fromTo(
    '.hey-card',
    { scale: 1 },
    {
      scale: 0.86,
      ease: 'none',
      scrollTrigger: {
        trigger: '#hero',
        scroller: document.body,
        start: 'top top',
        end: 'bottom top',
        scrub: true,
      },
    },
  );
  gsap.fromTo(
    '.code-window',
    { scale: 1 },
    {
      scale: 0.8,
      ease: 'none',
      scrollTrigger: {
        trigger: '#hero',
        scroller: document.body,
        start: 'top top',
        end: 'bottom top',
        scrub: true,
      },
    },
  );

  /* ABOUT PANEL — 3D "lid opening" reveal, independent of the outer .reveal fade wrapper */
  gsap.fromTo(
    '.about-poly',
    { rotateX: -35, opacity: 0.4 },
    {
      rotateX: 0,
      opacity: 1,
      ease: 'none',
      scrollTrigger: {
        trigger: '.about-poly',
        scroller: document.body,
        start: 'top 95%',
        end: 'top 55%',
        scrub: 0.6,
      },
    },
  );

  /* JOURNEY — the connecting line draws itself as you scroll, and each stop lights up as the line reaches it */
  const journeyFillEl = document.getElementById('journeyFill');
  const journeyListEl = document.getElementById('journeyList');
  const journeyItemEls = document.querySelectorAll('.journey-item');
  if (journeyFillEl && journeyListEl) {
    ScrollTrigger.create({
      trigger: journeyListEl,
      scroller: document.body,
      start: 'top 75%',
      end: 'bottom 60%',
      scrub: 0.4,
      onUpdate: (self) => {
        const p = self.progress;
        journeyFillEl.style.transform = `scaleY(${p})`;
        const jh = document.getElementById('journeyHead');
        if (jh) jh.style.top = p * 100 + '%';
        journeyItemEls.forEach((item) => {
          const frac = journeyListEl.offsetHeight ? item.offsetTop / journeyListEl.offsetHeight : 0;
          item.classList.toggle('lit', p >= frac - 0.03);
        });
      },
    });
  }

  /* HERO DOODLE PARALLAX ON SCROLL-OUT */
  document.querySelectorAll('.hero-doodle').forEach((el, i) => {
    gsap.to(el, {
      y: i % 2 === 0 ? -140 : 160,
      rotate: i % 2 === 0 ? 40 : -30,
      ease: 'none',
      scrollTrigger: {
        trigger: '#hero',
        scroller: document.body,
        start: 'top top',
        end: 'bottom top',
        scrub: true,
      },
    });
  });

  /* DRAGGABLE STICKY NOTES */
  document.querySelectorAll('.sticky-note[data-drag]').forEach((note) => {
    let dragging = false,
      startX = 0,
      startY = 0,
      origX = 0,
      origY = 0;
    note.addEventListener('pointerdown', (e) => {
      dragging = true;
      note.setPointerCapture(e.pointerId);
      const r = note.getBoundingClientRect();
      origX = r.left;
      origY = r.top;
      startX = e.clientX;
      startY = e.clientY;
      note.style.right = 'auto';
      note.style.bottom = 'auto';
      note.style.left = origX + 'px';
      note.style.top = origY + 'px';
      note.style.zIndex = 20;
    });
    note.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      note.style.left = origX + (e.clientX - startX) + 'px';
      note.style.top = origY + (e.clientY - startY) + 'px';
    });
    note.addEventListener('pointerup', () => {
      dragging = false;
    });
    note.addEventListener('pointercancel', () => {
      dragging = false;
    });
  });

  /* LOGO PARTY-MODE EASTER EGG */
  const navLogo = document.querySelector('.nav-logo');
  let logoClicks = 0,
    logoClickTimer = null;
  navLogo.addEventListener('click', () => {
    logoClicks++;
    clearTimeout(logoClickTimer);
    logoClickTimer = setTimeout(() => {
      logoClicks = 0;
    }, 1400);
    if (logoClicks >= 5) {
      logoClicks = 0;
      document.documentElement.classList.add('party-mode');
      for (let i = 0; i < 6; i++) {
        setTimeout(() => burstConfetti(Math.random() * window.innerWidth, -10), i * 140);
      }
      setTimeout(() => document.documentElement.classList.remove('party-mode'), 2400);
    }
  });

  /* HIRE-ME MODAL */
  const hireFab = document.getElementById('hireFab');
  const hireOverlay = document.getElementById('hireModalOverlay');
  const hireClose = document.getElementById('hireModalClose');
  function openHireModal() {
    hireOverlay.classList.add('open');
    burstConfetti(window.innerWidth / 2, window.innerHeight * 0.3);
  }
  function closeHireModal() {
    hireOverlay.classList.remove('open');
  }
  hireFab.addEventListener('click', openHireModal);
  hireClose.addEventListener('click', closeHireModal);
  hireOverlay.addEventListener('click', (e) => {
    if (e.target === hireOverlay) closeHireModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeHireModal();
  });

  /* CONFETTI BURST */
  function burstConfetti(x, y) {
    if (reduceMotion) return;
    const colors = ['#FF5A5F', '#FFD23F', '#8FE24B', '#B892FF', '#3B4CFF'];
    for (let i = 0; i < 26; i++) {
      const p = document.createElement('div');
      p.className = 'confetti-piece';
      p.style.background = colors[i % colors.length];
      p.style.left = x + 'px';
      p.style.top = y + 'px';
      document.body.appendChild(p);
      const angle = Math.random() * Math.PI * 2;
      const dist = 80 + Math.random() * 160;
      gsap.to(p, {
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist + 60,
        rotation: Math.random() * 360,
        opacity: 0,
        duration: 0.9 + Math.random() * 0.5,
        ease: 'power2.out',
        onComplete: () => p.remove(),
      });
    }
  }

  /* SIDE PROGRESS DOTS */
  const dotSections = [
    { id: 'hero', label: 'Top' },
    { id: 'replay', label: 'Replay' },
    { id: 'build', label: 'Build' },
    { id: 'about', label: 'About' },
    { id: 'metrics', label: 'Metrics' },
    { id: 'work', label: 'Work' },
    { id: 'github', label: 'GitHub' },
    { id: 'stack', label: 'Stack' },
    { id: 'journey', label: 'Journey' },
    { id: 'log', label: 'Log' },
    { id: 'contact', label: 'Contact' },
  ];
  const sideDotsEl = document.getElementById('sideDots');
  dotSections.forEach((s) => {
    const d = document.createElement('div');
    d.className = 'side-dot';
    d.dataset.target = s.id;
    d.innerHTML = `<span class="dot-tip">${s.label}</span>`;
    d.addEventListener('click', () => {
      const el = document.getElementById(s.id);
      if (!el) return;
      const targetY = el.getBoundingClientRect().top + currentScroll - 122;
      window.scrollTo({ top: Math.max(targetY, 0), behavior: 'auto' });
    });
    sideDotsEl.appendChild(d);
  });

  /* FLOATING CTA + LETTER-WAVE HOVER */
  const floatCta = document.getElementById('floatCta');
  const heyTitle = document.getElementById('heyTitle');
  if (heyTitle) {
    const txt = heyTitle.textContent;
    heyTitle.innerHTML = txt
      .split('')
      .map((ch) => `<span class="lw-char">${ch}</span>`)
      .join('');
    heyTitle.addEventListener('mouseenter', () => {
      const chars = heyTitle.querySelectorAll('.lw-char');
      gsap.fromTo(
        chars,
        { y: 0, rotate: 0 },
        {
          y: -16,
          rotate: () => gsap.utils.random(-8, 8),
          duration: 0.32,
          stagger: { each: 0.045, yoyo: true, repeat: 1 },
          ease: 'power2.inOut',
        },
      );
    });
  }

  /* PROGRESS + NAV */
  const progress = document.getElementById('traceProgress');
  const nav = document.getElementById('nav');
  let navLinks = null,
    sideDotEls = null,
    navCur = null,
    ctaShown = null;
  function tickNav() {
    /* transform instead of width: no layout work per frame */
    progress.style.transform =
      'scaleX(' + (layout.docMax > 0 ? Math.min(1, targetScroll / layout.docMax) : 0).toFixed(4) + ')';
    let current = sectionEls[0].id;
    for (let i = 0; i < sectionEls.length; i++) {
      if (currentScroll >= layout.tops[i] - 172) current = sectionEls[i].id;
    }
    if (current !== navCur) {
      navCur = current;
      if (!navLinks) navLinks = document.querySelectorAll('.nav-links a');
      navLinks.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + current));
      sideDotEls = document.querySelectorAll('.side-dot');
      sideDotEls.forEach((d) => d.classList.toggle('active', d.dataset.target === current));
    }
    const show = currentScroll > layout.heroH * 0.8 && current !== 'contact';
    if (show !== ctaShown) {
      ctaShown = show;
      floatCta.classList.toggle('show', show);
    }
  }
  document.querySelectorAll('.nav-links a, .nav-cta').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const el = document.querySelector(a.getAttribute('href'));
      if (!el) return;
      const targetY = el.getBoundingClientRect().top + currentScroll - 122;
      window.scrollTo({ top: Math.max(targetY, 0), behavior: 'auto' });
    });
  });

  /* WORK CAROUSEL */
  const workTrack = document.getElementById('workTrack');
  document
    .getElementById('workNext')
    .addEventListener('click', () => workTrack.scrollBy({ left: 340, behavior: 'smooth' }));
  document
    .getElementById('workPrev')
    .addEventListener('click', () => workTrack.scrollBy({ left: -340, behavior: 'smooth' }));

  /* WORK CAROUSEL 3D COVERFLOW — driven by horizontal scroll, independent of the vertical smooth-scroll rig */
  const workCards = Array.from(document.querySelectorAll('.work-card'));
  function updateCoverflow() {
    if (reduceMotion || !workCards.length) return;
    const trackRect = workTrack.getBoundingClientRect();
    const centerX = trackRect.left + trackRect.width / 2;
    workCards.forEach((card) => {
      const r = card.getBoundingClientRect();
      const cardCenter = r.left + r.width / 2;
      const dist = (cardCenter - centerX) / (trackRect.width / 2);
      const clamped = Math.max(-1, Math.min(1, dist));
      const rotateY = clamped * -14;
      const scale = 1 - Math.abs(clamped) * 0.06;
      const translateZ = -Math.abs(clamped) * 40;
      card.style.transform = `perspective(1400px) rotateY(${rotateY.toFixed(2)}deg) scale(${scale.toFixed(3)}) translateZ(${translateZ.toFixed(1)}px)`;
    });
  }
  workTrack.addEventListener('scroll', () => requestAnimationFrame(updateCoverflow), { passive: true });
  window.addEventListener('resize', updateCoverflow);
  setTimeout(updateCoverflow, 1300);

  /* SKILL SLIDERS (drag) */
  document.querySelectorAll('.skill-slider').forEach((slider) => {
    const dot = slider.querySelector('.dot');
    let dragging = false;
    function setPct(clientX) {
      const r = slider.getBoundingClientRect();
      let pct = ((clientX - r.left) / r.width) * 100;
      pct = Math.max(4, Math.min(96, pct));
      dot.style.left = pct + '%';
    }
    dot.addEventListener('pointerdown', (e) => {
      dragging = true;
      dot.setPointerCapture(e.pointerId);
    });
    dot.addEventListener('pointermove', (e) => {
      if (dragging) setPct(e.clientX);
    });
    dot.addEventListener('pointerup', () => (dragging = false));
    dot.addEventListener('pointercancel', () => (dragging = false));
  });

  /* REPLAY SCRUBBER */
  const replayCheckpoints = [
    {
      pos: 0,
      year: '2021',
      status: 'provisioning',
      color: '#FF5A5F',
      title: 'Starting B.Sc Computer Science',
      lines: [
        'brock university — software engineering concentration',
        'span initialized. duration: ~4yr. status: provisioning',
      ],
    },
    {
      pos: 180,
      year: '2022',
      status: 'provisioning',
      color: '#FF5A5F',
      title: 'Building fundamentals',
      lines: ['coursework: data structures, systems, databases', 'span in progress. no incidents recorded'],
    },
    {
      pos: 340,
      year: '2023',
      status: 'provisioning',
      color: '#FF5A5F',
      title: 'Going deeper',
      lines: ['software engineering coursework ramping up', 'span in progress. dean-list track'],
    },
    {
      pos: 470,
      year: '2024',
      status: 'building',
      color: '#FFD23F',
      title: 'Software Developer Intern — E Planet Global',
      lines: ['stack: react, typescript, django, .net', 'serving 50,000+ daily users. span: may–dec 2024'],
    },
    {
      pos: 620,
      year: '2024',
      status: 'shipping',
      color: '#FFD23F',
      title: 'Shipping in production',
      lines: ['built rest apis w/ node.js + sql server', 'api p95 response time down 30%. tests added'],
    },
    {
      pos: 730,
      year: '2025',
      status: 'resolved',
      color: '#8FE24B',
      title: 'Graduated — Dean\u2019s Honor List',
      lines: ['brock university, b.sc computer science', 'span closed. status: completed successfully'],
    },
    {
      pos: 800,
      year: '2025',
      status: 'active',
      color: '#FFD23F',
      title: 'Joined Pitama Foods as Software Developer I',
      lines: [
        'leading internal spa tooling — catalog, inventory, orders',
        'order-processing efficiency up 20%. span: active',
      ],
    },
    {
      pos: 900,
      year: '2025',
      status: 'active',
      color: '#FFD23F',
      title: 'IBM Full Stack Developer certified',
      lines: ['completed via coursera / ibm alongside full-time role', 'credential attached to span'],
    },
    {
      pos: 1000,
      year: 'now',
      status: 'observing',
      color: '#B892FF',
      title: 'Building an AI incident-response copilot',
      lines: [
        'correlating prometheus + grafana + jaeger via claude api',
        'diagnosis time down ~90%. open to new roles',
      ],
    },
  ];
  const replaySlider = document.getElementById('replaySlider'),
    replayLog = document.getElementById('replayLog');
  const replayYear = document.getElementById('replayYear'),
    replayStatus = document.getElementById('replayStatus'),
    replayDot = document.getElementById('replayDot'),
    replayPlay = document.getElementById('replayPlay');
  let lastCheckpointIdx = -1;
  function findCheckpoint(pos) {
    let idx = 0;
    for (let i = 0; i < replayCheckpoints.length; i++) {
      if (pos >= replayCheckpoints[i].pos) idx = i;
    }
    return idx;
  }
  function updateReplay(pos) {
    const pct = (pos / 1000) * 100;
    replaySlider.style.background = `linear-gradient(90deg, var(--yellow) ${pct}%, #333 ${pct}%)`;
    const idx = findCheckpoint(pos);
    if (idx === lastCheckpointIdx) return;
    lastCheckpointIdx = idx;
    const cp = replayCheckpoints[idx];
    replayYear.textContent = cp.year;
    replayStatus.textContent = cp.status;
    replayDot.style.background = cp.color;
    gsap.fromTo(replayLog, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' });
    replayLog.innerHTML =
      `<div class="rl-title">${cp.title}</div>` +
      cp.lines.map((l) => `<div class="rl-line">${l}</div>`).join('');
  }
  replaySlider.addEventListener('input', () => {
    stopAutoplay();
    updateReplay(parseInt(replaySlider.value, 10));
  });
  let autoplayRAF = null,
    autoplayStart = null;
  const AUTOPLAY_DURATION = 7000;
  function stepAutoplay(ts) {
    if (!autoplayStart) autoplayStart = ts;
    const elapsed = ts - autoplayStart;
    const pos = Math.min(1000, (elapsed / AUTOPLAY_DURATION) * 1000);
    replaySlider.value = pos;
    updateReplay(pos);
    if (pos < 1000) {
      autoplayRAF = requestAnimationFrame(stepAutoplay);
    } else {
      stopAutoplay();
    }
  }
  function startAutoplay() {
    replaySlider.value = 0;
    lastCheckpointIdx = -1;
    updateReplay(0);
    autoplayStart = null;
    replayPlay.textContent = '■ stop replay';
    autoplayRAF = requestAnimationFrame(stepAutoplay);
  }
  function stopAutoplay() {
    if (autoplayRAF) cancelAnimationFrame(autoplayRAF);
    autoplayRAF = null;
    autoplayStart = null;
    replayPlay.textContent = '▸ play replay';
  }
  replayPlay.addEventListener('click', () => {
    if (autoplayRAF) {
      stopAutoplay();
    } else {
      startAutoplay();
    }
  });
  updateReplay(0);

  /* CONTACT FORM */
  const form = document.getElementById('contactForm'),
    resp = document.getElementById('tresponse');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const name = document.getElementById('cf-name').value.trim(),
      email = document.getElementById('cf-email').value.trim(),
      msg = document.getElementById('cf-msg').value.trim();
    resp.classList.add('show');
    resp.innerHTML = '';
    const btnRect = form.querySelector('.tform-submit').getBoundingClientRect();
    burstConfetti(btnRect.left + btnRect.width / 2, btnRect.top);
    const outLines = [
      '> validating payload... ok',
      '> queued message from ' + (name || 'anonymous'),
      '> sending...',
    ];
    outLines.forEach((line, i) => {
      setTimeout(() => {
        const d = document.createElement('div');
        d.textContent = line;
        resp.appendChild(d);
      }, i * 380);
    });
    setTimeout(
      () => {
        window.__sendContact(name, email, msg, resp);
      },
      outLines.length * 380 + 300,
    );
  });

  setTimeout(() => {
    ScrollTrigger.refresh();
    setBodyHeight();
  }, 1200);

  /* LIVE STATUS PILL (Karachi local time) */
  const statusPillText = document.getElementById('statusPillText');
  function updateStatusPill() {
    if (!statusPillText) return;
    const now = new Date();
    const karachiTime = now.toLocaleTimeString('en-US', {
      timeZone: 'Asia/Karachi',
      hour: 'numeric',
      minute: '2-digit',
    });
    const hour = parseInt(
      now.toLocaleString('en-US', { timeZone: 'Asia/Karachi', hour: 'numeric', hour12: false }),
    );
    let mood = 'probably debugging something';
    if (hour >= 1 && hour < 7) mood = 'asleep (hopefully)';
    else if (hour >= 7 && hour < 10) mood = 'starting the day with coffee';
    else if (hour >= 10 && hour < 18) mood = 'heads-down building';
    else if (hour >= 18 && hour < 23) mood = 'probably debugging something';
    else mood = 'still awake, still shipping';
    statusPillText.textContent = `${karachiTime} in Karachi — ${mood}`;
  }
  updateStatusPill();
  setInterval(updateStatusPill, 30000);

  /* TAB TITLE EASTER EGG */
  const originalTitle = document.title;
  let titleTimer = null;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      document.title = '👋 come back?';
      clearTimeout(titleTimer);
      titleTimer = setTimeout(() => {
        document.title = 'This site misses you 🥲';
      }, 3000);
    } else {
      clearTimeout(titleTimer);
      document.title = originalTitle;
    }
  });

  /* KEYBOARD SHORTCUTS */
  const kbdOverlay = document.getElementById('kbdOverlay');
  const kbdClose = document.getElementById('kbdClose');
  function openKbd() {
    kbdOverlay.classList.add('open');
  }
  function closeKbd() {
    kbdOverlay.classList.remove('open');
  }
  kbdClose.addEventListener('click', closeKbd);
  kbdOverlay.addEventListener('click', (e) => {
    if (e.target === kbdOverlay) closeKbd();
  });
  document.querySelector('.kbd-hint').addEventListener('click', openKbd);

  function jumpSection(dir) {
    const ids = dotSections.map((s) => s.id);
    let current = ids[0];
    sections.forEach((sec) => {
      if (currentScroll >= sec.offsetTop - 172) current = sec.id;
    });
    let idx = ids.indexOf(current);
    idx = Math.max(0, Math.min(ids.length - 1, idx + dir));
    const el = document.getElementById(ids[idx]);
    if (!el) return;
    const targetY = el.getBoundingClientRect().top + currentScroll - 122;
    window.scrollTo({ top: Math.max(targetY, 0), behavior: 'auto' });
  }

  document.addEventListener('keydown', (e) => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    if (e.key === '?') {
      openKbd();
    } else if (e.key === 'Escape') {
      closeKbd();
      closeHireModal();
    } else if (e.key.toLowerCase() === 'g') {
      goldSwitch.click();
    } else if (e.key.toLowerCase() === 'h') {
      openHireModal();
    } else if (e.key.toLowerCase() === 'j') {
      jumpSection(1);
    } else if (e.key.toLowerCase() === 'k') {
      jumpSection(-1);
    }
  });

  /* =====================================================================
     v9 ANIMATION LAYER
     ===================================================================== */
  const hasHover = window.matchMedia('(hover:hover)').matches;
  const rand = (a, b) => a + Math.random() * (b - a);

  /* ---------- particle engine: cursor trail + click sparks ---------- */
  const fxCanvas = document.getElementById('fxCanvas');
  const fxCtx = fxCanvas.getContext('2d');
  let FW = 0,
    FH = 0;
  const FDPR = Math.min(window.devicePixelRatio || 1, 1.5);
  function sizeFx() {
    FW = window.innerWidth;
    FH = window.innerHeight;
    fxCanvas.width = FW * FDPR;
    fxCanvas.height = FH * FDPR;
    fxCanvas.style.width = FW + 'px';
    fxCanvas.style.height = FH + 'px';
    fxCtx.setTransform(FDPR, 0, 0, FDPR, 0, 0);
  }
  sizeFx();
  window.addEventListener('resize', sizeFx);
  const fxColors = ['#FFD23F', '#FF5A5F', '#8FE24B', '#B892FF', '#FDFDF9'];
  const fxParts = [];
  let fxRunning = false;
  function fxSpawn(x, y, o) {
    fxParts.push({
      x,
      y,
      vx: o.vx || 0,
      vy: o.vy || 0,
      g: o.g || 0,
      s: o.s,
      life: o.life,
      max: o.life,
      shape: o.shape || 0,
      c: fxColors[(Math.random() * fxColors.length) | 0],
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
    });
    if (!fxRunning) {
      fxRunning = true;
      requestAnimationFrame(fxLoop);
    }
  }
  function fxLoop() {
    fxCtx.clearRect(0, 0, FW, FH);
    for (let i = fxParts.length - 1; i >= 0; i--) {
      const p = fxParts[i];
      p.life--;
      if (p.life <= 0) {
        fxParts.splice(i, 1);
        continue;
      }
      p.vy += p.g;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      const t = p.life / p.max,
        s = p.s * (0.3 + 0.7 * t);
      fxCtx.save();
      fxCtx.translate(p.x, p.y);
      fxCtx.rotate(p.r);
      fxCtx.fillStyle = p.c;
      fxCtx.strokeStyle = '#0B0B0F';
      fxCtx.lineWidth = 2;
      if (p.shape === 1) {
        fxCtx.beginPath();
        fxCtx.arc(0, 0, s / 2, 0, Math.PI * 2);
        fxCtx.fill();
        fxCtx.stroke();
      } else if (p.shape === 3) {
        fxCtx.beginPath();
        for (let k = 0; k < 8; k++) {
          const rr = k % 2 === 0 ? s * 0.75 : s * 0.22,
            a = (k * Math.PI) / 4;
          fxCtx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        fxCtx.closePath();
        fxCtx.fill();
        fxCtx.stroke();
      } else {
        fxCtx.beginPath();
        fxCtx.rect(-s / 2, -s / 2, s, s);
        fxCtx.fill();
        fxCtx.stroke();
      }
      fxCtx.restore();
    }
    if (fxParts.length) {
      requestAnimationFrame(fxLoop);
    } else {
      fxRunning = false;
      fxCtx.clearRect(0, 0, FW, FH);
    }
  }
  let lastTX = null,
    lastTY = null,
    trailDist = 0;
  if (hasHover && !reduceMotion) {
    window.addEventListener('mousemove', (e) => {
      if (lastTX !== null) {
        trailDist += Math.hypot(e.clientX - lastTX, e.clientY - lastTY);
      }
      lastTX = e.clientX;
      lastTY = e.clientY;
      if (trailDist > 26) {
        trailDist = 0;
        fxSpawn(e.clientX, e.clientY, {
          vx: rand(-0.6, 0.6),
          vy: rand(-0.6, 0.6),
          s: rand(8, 13),
          life: 36,
          shape: Math.random() < 0.5 ? 0 : 1,
        });
      }
    });
  }
  window.addEventListener('pointerdown', (e) => {
    if (reduceMotion) return;
    const tg = (e.target.tagName || '').toLowerCase();
    if (tg === 'input' || tg === 'textarea') return;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + rand(-0.2, 0.2),
        sp = rand(3, 7);
      fxSpawn(e.clientX, e.clientY, {
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        g: 0.18,
        s: rand(8, 13),
        life: rand(30, 44),
        shape: i % 3 === 0 ? 3 : i % 2 ? 0 : 1,
      });
    }
  });

  /* ---------- toast ---------- */
  const toastEl = document.getElementById('toast');
  let toastT = null;
  function showToast(msg, ms) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('show'), ms || 2600);
  }

  /* ---------- text scramble (decode) ---------- */
  const GLY = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#<>/{}=+*';
  function scramble(el, dur) {
    if (reduceMotion) return;
    const finalTxt = el.dataset.final || (el.dataset.final = el.textContent);
    dur = dur || 520;
    let start = null;
    cancelAnimationFrame(el._sr);
    function f(t) {
      if (start === null) start = t;
      const p = Math.min((t - start) / dur, 1);
      let out = '';
      for (let i = 0; i < finalTxt.length; i++) {
        const ch = finalTxt[i];
        if (/[\s◆✦→↗'.,!?-]/.test(ch) || i / finalTxt.length < p) {
          out += ch;
        } else {
          out += GLY[(Math.random() * GLY.length) | 0];
        }
      }
      el.textContent = out;
      if (p < 1) {
        el._sr = requestAnimationFrame(f);
      } else {
        el.textContent = finalTxt;
      }
    }
    el._sr = requestAnimationFrame(f);
  }
  document.querySelectorAll('.nav-links a, .nav-cta').forEach((a) => {
    a.addEventListener('mouseenter', () => {
      if (!a.dataset.sized) {
        a.style.display = 'inline-block';
        a.style.minWidth = a.offsetWidth + 'px';
        a.style.textAlign = 'center';
        a.dataset.sized = '1';
      }
      scramble(a, 380);
    });
  });
  document.querySelectorAll('.eyebrow').forEach((el) => {
    ScrollTrigger.create({
      trigger: el,
      scroller: document.body,
      start: 'top 92%',
      once: true,
      onEnter: () => scramble(el, 700),
    });
  });

  /* ---------- cursor spotlight grid per section + card glow ---------- */
  document.querySelectorAll('section').forEach((s) => {
    const light = s.classList.contains('section-black') || s.classList.contains('section-contact');
    s.classList.add('spot', light ? 'tone-light' : 'tone-dark');
  });
  let hoverSec = null,
    pmx = 0,
    pmy = 0;
  function clearSpot(s) {
    if (s) {
      s.style.setProperty('--mx', '-999px');
      s.style.setProperty('--my', '-999px');
    }
  }
  if (hasHover) {
    document.addEventListener('mousemove', (e) => {
      pmx = e.clientX;
      pmy = e.clientY;
      const s = e.target.closest ? e.target.closest('section.spot') : null;
      if (s !== hoverSec) {
        clearSpot(hoverSec);
        hoverSec = s;
      }
      const card = e.target.closest ? e.target.closest('.gh-card,.build-step,.stack-panel,.work-card') : null;
      if (card) {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--gx', e.clientX - r.left + 'px');
        card.style.setProperty('--gy', e.clientY - r.top + 'px');
      }
      if (spotKick) spotKick();
    });
    document.addEventListener('mouseleave', () => {
      clearSpot(hoverSec);
      hoverSec = null;
    });
    /* only runs while the pointer is over a section and something changed */
    let spotRaf = 0,
      spotX = NaN,
      spotY = NaN,
      spotS = NaN;
    function spotTick() {
      spotRaf = 0;
      if (!hoverSec) return;
      if (pmx !== spotX || pmy !== spotY || currentScroll !== spotS) {
        spotX = pmx;
        spotY = pmy;
        spotS = currentScroll;
        const r = hoverSec.getBoundingClientRect();
        hoverSec.style.setProperty('--mx', pmx - r.left + 'px');
        hoverSec.style.setProperty('--my', pmy - r.top + 'px');
      }
    }
    spotKick = () => {
      if (!spotRaf && hoverSec) spotRaf = requestAnimationFrame(spotTick);
    };
  }

  /* ---------- hero: mouse parallax depth layers + 3D tilt ---------- */
  const heroEl = document.getElementById('hero');
  if (hasHover && !reduceMotion && heroEl) {
    const layers = Array.from(document.querySelectorAll('.px')).map((el) => ({
      el,
      d: parseFloat(el.dataset.depth || '20'),
      qx: gsap.quickTo(el, 'x', { duration: 0.8, ease: 'power3' }),
      qy: gsap.quickTo(el, 'y', { duration: 0.8, ease: 'power3' }),
    }));
    const hey = document.querySelector('.hey-card'),
      cw = document.querySelector('.code-window');
    gsap.set([hey, cw], { transformPerspective: 900 });
    const heyRX = gsap.quickTo(hey, 'rotationX', { duration: 0.6, ease: 'power3' }),
      heyRY = gsap.quickTo(hey, 'rotationY', { duration: 0.6, ease: 'power3' });
    const cwRX = gsap.quickTo(cw, 'rotationX', { duration: 0.6, ease: 'power3' }),
      cwRY = gsap.quickTo(cw, 'rotationY', { duration: 0.6, ease: 'power3' });
    heroEl.addEventListener('mousemove', (e) => {
      const nx = e.clientX / window.innerWidth - 0.5,
        ny = e.clientY / window.innerHeight - 0.5;
      layers.forEach((l) => {
        l.qx(-nx * l.d);
        l.qy(-ny * l.d);
      });
      heyRY(nx * 7);
      heyRX(-ny * 6);
      cwRY(nx * 9);
      cwRX(-ny * 8);
    });
    heroEl.addEventListener('mouseleave', () => {
      heyRX(0);
      heyRY(0);
      cwRX(0);
      cwRY(0);
      layers.forEach((l) => {
        l.qx(0);
        l.qy(0);
      });
    });
  }

  /* ---------- hero: typewriter code window + role cycler ---------- */
  const codeTokens = [
    ['kw', 'const'],
    [null, ' engineer = '],
    ['kw', '{'],
    [null, '\n  name: '],
    ['st', "'Rohal Kabir'"],
    [null, ',\n  stack: '],
    ['st', "['react','node','django']"],
    [null, ',\n  focus: '],
    ['st', "'observability'"],
    [null, ',\n  status: '],
    ['st', "'open_to_work'"],
    [null, '\n'],
    ['kw', '}'],
    [null, ';\n'],
    ['cm', "// builds things that don't page you at 2am"],
  ];
  const codeBody = document.querySelector('.code-window-body');
  let typingStarted = false;
  function startTyping() {
    if (typingStarted || !codeBody) return;
    typingStarted = true;
    codeBody.innerHTML = '';
    const caret = document.createElement('span');
    caret.className = 'tcaret';
    if (reduceMotion) {
      codeTokens.forEach(([cls, txt]) => {
        const sp = document.createElement('span');
        if (cls) sp.className = cls;
        sp.textContent = txt;
        codeBody.appendChild(sp);
      });
      codeBody.appendChild(caret);
      return;
    }
    codeBody.appendChild(caret);
    let ti = 0,
      ci = 0,
      cur = null;
    (function step() {
      if (ti >= codeTokens.length) return;
      const [cls, txt] = codeTokens[ti];
      if (ci === 0) {
        cur = document.createElement('span');
        if (cls) cur.className = cls;
        codeBody.insertBefore(cur, caret);
      }
      const ch = txt[ci];
      cur.textContent += ch;
      ci++;
      if (ci >= txt.length) {
        ti++;
        ci = 0;
      }
      setTimeout(step, ch === '\n' ? 140 : rand(14, 34));
    })();
  }
  const roles = ['React apps', 'REST APIs', 'AI agents', 'trace dashboards', "things that don't break"];
  const rcWord = document.getElementById('rcWord');
  let rolesStarted = false,
    ri = 0;
  function startRoles() {
    if (rolesStarted || !rcWord || reduceMotion) return;
    rolesStarted = true;
    setInterval(() => {
      gsap.to(rcWord, {
        yPercent: -120,
        duration: 0.3,
        ease: 'power2.in',
        onComplete: () => {
          ri = (ri + 1) % roles.length;
          rcWord.textContent = roles[ri];
          gsap.fromTo(rcWord, { yPercent: 120 }, { yPercent: 0, duration: 0.45, ease: 'power3.out' });
        },
      });
    }, 2300);
  }
  window.__heroReady = function () {
    setTimeout(startTyping, 700);
    setTimeout(startRoles, 1200);
    setTimeout(() => mascotSay(greetingLine(), 3200), 2600);
  };
  if (window.__heroPlayed) window.__heroReady();

  /* ---------- mascot "Bit": eyes follow the cursor, blinks, reacts to clicks ---------- */
  const mascot = document.getElementById('mascot');
  const mBubble = document.getElementById('mascotBubble');
  const pupilL = document.getElementById('mPupilL'),
    pupilR = document.getElementById('mPupilR');
  const eyeL = document.getElementById('mEyeL'),
    eyeR = document.getElementById('mEyeR');
  const mMouth = document.getElementById('mMouth');
  let bubbleT = null;
  function mascotSay(msg, ms) {
    if (!mBubble) return;
    mBubble.textContent = msg;
    mBubble.classList.add('show');
    clearTimeout(bubbleT);
    bubbleT = setTimeout(() => mBubble.classList.remove('show'), ms || 2600);
  }
  if (mascot) {
    function look(cx, cy) {
      [
        [eyeL, pupilL],
        [eyeR, pupilR],
      ].forEach(([eye, pupil]) => {
        const r = eye.getBoundingClientRect();
        const ex = r.left + r.width / 2,
          ey = r.top + r.height / 2;
        const dx = cx - ex,
          dy = cy - ey,
          dist = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, dist / 160) * 5.5;
        pupil.setAttribute(
          'transform',
          `translate(${((dx / dist) * k).toFixed(2)} ${((dy / dist) * k).toFixed(2)})`,
        );
      });
    }
    const leanTo = gsap.quickTo(mascot, 'rotation', { duration: 0.5, ease: 'power3' });
    window.addEventListener('mousemove', (e) => {
      look(e.clientX, e.clientY);
      const r = mascot.getBoundingClientRect();
      leanTo(Math.max(-7, Math.min(7, (e.clientX - (r.left + r.width / 2)) / 140)));
    });
    function blink() {
      if (!reduceMotion) {
        gsap.to(eyeL, { scaleY: 0.08, svgOrigin: '68 104', duration: 0.07, yoyo: true, repeat: 1 });
        gsap.to(eyeR, { scaleY: 0.08, svgOrigin: '102 104', duration: 0.07, yoyo: true, repeat: 1 });
      }
      setTimeout(blink, rand(2400, 5200));
    }
    setTimeout(blink, 2000);
    const quips = [
      "Hi! I'm Bit 👋 I debug this site.",
      'Rohal built me in an afternoon. Hire him.',
      '90% faster incident diagnosis. Just saying.',
      'Press ? for keyboard shortcuts.',
      'Ship it. 🚢',
      'Have you tried turning it off and on again?',
      'I only have two moods: happy, and also happy.',
    ];
    let qi = 0,
      pokes = 0,
      pokeT = null;
    mascot.addEventListener('click', (e) => {
      pokes++;
      clearTimeout(pokeT);
      pokeT = setTimeout(() => {
        pokes = 0;
      }, 2000);
      const msg = pokes >= 5 ? 'Okay okay — calling HR. 📞' : quips[qi++ % quips.length];
      mascotSay(msg, 2800);
      mMouth.setAttribute('d', 'M74 122 Q85 138 96 122 Q85 128 74 122 Z');
      mMouth.setAttribute('fill', '#8FE24B');
      setTimeout(() => {
        mMouth.setAttribute('d', 'M72 124 Q85 133 98 124');
        mMouth.setAttribute('fill', 'none');
      }, 900);
      if (!reduceMotion) {
        gsap.fromTo(
          mascot,
          { y: 0, scaleY: 0.9, transformOrigin: '50% 100%' },
          { y: -42, scaleY: 1.04, duration: 0.26, ease: 'power2.out', yoyo: true, repeat: 1 },
        );
        const r = mascot.getBoundingClientRect();
        burstConfetti(r.left + r.width / 2, r.top + r.height * 0.35);
      }
    });
  }

  /* ---------- wavy dividers breathe (SMIL path morph) ---------- */
  if (!reduceMotion) {
    document.querySelectorAll('.wave-divider path').forEach((p, i) => {
      const d = p.getAttribute('d');
      if (!d) return;
      const pairs = d.match(/-?\d+(\.\d+)?,-?\d+(\.\d+)?/g);
      if (!pairs || pairs.length < 9) return;
      const variant = (seed) => {
        let k = 0;
        return d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (m, x, y) => {
          const idx = k++;
          if (idx > 6) return m;
          const ny = Math.max(2, Math.min(98, parseFloat(y) + Math.sin(seed + idx * 1.9) * 34));
          return x + ',' + ny.toFixed(1);
        });
      };
      const a = variant(i * 1.3 + 1),
        b = variant(i * 1.3 + 4.1);
      const an = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
      an.setAttribute('attributeName', 'd');
      an.setAttribute('values', [d, a, b, d].join(';'));
      an.setAttribute('keyTimes', '0;.33;.66;1');
      an.setAttribute('calcMode', 'spline');
      an.setAttribute('keySplines', '.45 0 .55 1;.45 0 .55 1;.45 0 .55 1');
      an.setAttribute('dur', 7 + (i % 4) * 1.5 + 's');
      an.setAttribute('begin', '-' + i * 1.4 + 's');
      an.setAttribute('repeatCount', 'indefinite');
      p.appendChild(an);
    });
  }

  /* ---------- stack chips: pointer-repulsion field ---------- */
  if (hasHover && !reduceMotion) {
    document.querySelectorAll('.stack-panel').forEach((panel) => {
      const nodes = Array.from(panel.querySelectorAll('.node'));
      panel.addEventListener('mousemove', (e) => {
        nodes.forEach((n) => {
          const r = n.getBoundingClientRect(),
            cx = r.left + r.width / 2,
            cy = r.top + r.height / 2;
          const dx = cx - e.clientX,
            dy = cy - e.clientY,
            dist = Math.hypot(dx, dy) || 1,
            R = 95;
          const push = dist < R ? (1 - dist / R) * 16 : 0;
          gsap.to(n, {
            '--ox': ((dx / dist) * push).toFixed(1) + 'px',
            '--oy': ((dy / dist) * push).toFixed(1) + 'px',
            duration: 0.35,
            ease: 'power3.out',
            overwrite: 'auto',
          });
        });
      });
      panel.addEventListener('mouseleave', () => {
        nodes.forEach((n) =>
          gsap.to(n, {
            '--ox': '0px',
            '--oy': '0px',
            duration: 0.6,
            ease: 'elastic.out(1,.5)',
            overwrite: 'auto',
          }),
        );
      });
    });
  }

  /* ---------- work stamps slam down when their card comes into view ---------- */
  document.querySelectorAll('.stamp').forEach((st) => {
    if (reduceMotion) return;
    gsap.set(st, { opacity: 0, scale: 3.2 });
    const card = st.closest('.work-card');
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            gsap.to(st, { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(2.2)', delay: 0.25 });
            io.disconnect();
          }
        });
      },
      { threshold: 0.55 },
    );
    io.observe(card);
  });

  /* ---------- konami code -> debug mode ---------- */
  const konami = [
    'arrowup',
    'arrowup',
    'arrowdown',
    'arrowdown',
    'arrowleft',
    'arrowright',
    'arrowleft',
    'arrowright',
    'b',
    'a',
  ];
  let kpos = 0;
  document.addEventListener('keydown', (e) => {
    const k = (e.key || '').toLowerCase();
    kpos = k === konami[kpos] ? kpos + 1 : k === konami[0] ? 1 : 0;
    if (kpos === konami.length) {
      kpos = 0;
      const on = document.documentElement.classList.toggle('debug-mode');
      showToast(on ? '🐛 debug mode: ON — every element outlined' : 'debug mode: off', 3200);
      if (on) {
        burstConfetti(window.innerWidth / 2, window.innerHeight / 3);
        if (window.__ach) window.__ach('konami');
      }
    }
  });

  /* =====================================================================
     v10 FEATURE LAYER: wipes, palette, terminal, Bit chat + voice, game,
     case studies, live GitHub activity, time-aware greeting
     ===================================================================== */
  const $ = (id) => document.getElementById(id);
  const esc = (t) =>
    String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const lsGet = (k) => {
    try {
      return localStorage.getItem(k);
    } catch (e) {
      return null;
    }
  };
  const lsSet = (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch (e) {}
  };

  const palOv = $('palOv'),
    palInput = $('palInput'),
    palList = $('palList');
  const termOv = $('termOv'),
    termOut = $('termOut'),
    termIn = $('termIn');
  const chatEl = $('chat'),
    chatLog = $('chatLog'),
    chatFab = $('chatFab'),
    chatChips = $('chatChips');
  const gameOv = $('gameOv'),
    caseOv = $('caseOv');
  const ovs = [palOv, termOv, gameOv, caseOv];
  const anyOv = () => ovs.some((o) => o.classList.contains('open')) || chatEl.classList.contains('open');
  function openOv(o) {
    closeOvs(o);
    o.classList.add('open');
  }
  function closeOvs(except) {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    ovs.forEach((o) => {
      if (o !== except) o.classList.remove('open');
    });
    if (except !== gameOv) stopGame();
  }

  /* ---------- section-to-section page wipe ---------- */
  const wipe = $('wipe'),
    wipeTxt = $('wipeTxt');
  const wipeCols = ['#FF5A5F', '#FFD23F', '#8FE24B', '#B892FF'];
  let wipeI = 0,
    wiping = false;
  const secLabels = {
    hero: 'Top',
    replay: 'Replay',
    build: 'Build',
    about: 'About',
    metrics: 'Metrics',
    work: 'Work',
    github: 'GitHub',
    stack: 'Stack',
    journey: 'Journey',
    log: 'Build log',
    contact: 'Contact',
  };
  function scrollToId(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const y = el.getBoundingClientRect().top + currentScroll - 122;
    window.scrollTo({ top: Math.max(y, 0), behavior: 'auto' });
  }
  function goTo(id) {
    if (!document.getElementById(id)) return;
    closeOvs();
    chatEl.classList.remove('open');
    if (reduceMotion) {
      scrollToId(id);
      return;
    }
    if (wiping) return;
    wiping = true;
    wipe.style.background = wipeCols[wipeI++ % wipeCols.length];
    wipeTxt.textContent = secLabels[id] || id;
    if (window.__sfx) window.__sfx.whoosh();
    gsap
      .timeline({
        onComplete: () => {
          wiping = false;
        },
      })
      .fromTo(wipe, { xPercent: -101, x: 0 }, { xPercent: 0, duration: 0.36, ease: 'power3.inOut' })
      .add(() => scrollToId(id))
      .fromTo(wipeTxt, { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.25, ease: 'power3.out' }, '<')
      .to(wipe, { xPercent: 101, duration: 0.4, ease: 'power3.inOut' }, '+=.18');
  }
  document.addEventListener(
    'click',
    (e) => {
      const a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
      if (!a) return;
      const h = a.getAttribute('href');
      if (!h || h.length < 2) return;
      if (!document.getElementById(h.slice(1))) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      goTo(h.slice(1));
    },
    true,
  );

  /* ---------- actions shared by palette / terminal / chat ---------- */
  const A = {
    hire: () => {
      closeOvs();
      chatEl.classList.remove('open');
      openHireModal();
    },
    gold: () => {
      goldSwitch.click();
    },
    resume: () => {
      window.open('Rohal_Kabir_Resume.pdf', '_blank');
    },
    email: () => {
      location.href = 'mailto:kabirrohal7@gmail.com';
    },
    github: () => {
      window.open('https://github.com/rohal20', '_blank');
    },
    term: () => {
      if (window.__ach) window.__ach('terminal');
      if (window.__bitReact) window.__bitReact('terminal');
      chatEl.classList.remove('open');
      openOv(termOv);
      if (!termOut.dataset.init) termInit();
      termIn.focus();
    },
    game: () => {
      if (window.__ach) window.__ach('game');
      if (window.__bitReact) window.__bitReact('game');
      chatEl.classList.remove('open');
      openOv(gameOv);
      startGame();
    },
    chat: () => {
      closeOvs();
      openChat();
    },
    confetti: () => {
      burstConfetti(window.innerWidth / 2, window.innerHeight / 2);
    },
    debug: () => {
      const on = document.documentElement.classList.toggle('debug-mode');
      showToast(on ? '🐛 debug mode: ON' : 'debug mode: off');
    },
  };

  /* ---------- command palette ---------- */
  const cmds = [
    ['🏠', 'Go to Top', 'hero', () => goTo('hero')],
    ['🛠', 'Go to How I build', 'build', () => goTo('build')],
    ['🙋', 'Go to About', 'about', () => goTo('about')],
    ['📊', 'Go to Dev metrics', 'metrics', () => goTo('metrics')],
    ['💼', 'Go to Work', 'work experience projects', () => goTo('work')],
    ['🐙', 'Go to GitHub', 'github repos', () => goTo('github')],
    ['🧰', 'Go to Tech stack', 'stack skills', () => goTo('stack')],
    ['🧭', 'Go to Journey', 'journey timeline', () => goTo('journey')],
    ['📬', 'Go to Contact', 'contact', () => goTo('contact')],
    ['🤝', 'Why hire Rohal?', 'hire modal', A.hire],
    ['📄', 'Open résumé (PDF)', 'resume cv', A.resume],
    ['✉️', 'Send an email', 'mail contact', A.email],
    ['🐙', 'Open GitHub profile', 'github', A.github],
    ['💬', 'Chat with Bit', 'ask bit assistant', A.chat],
    ['⌨️', 'Open terminal', 'shell console', A.term],
    ['🎮', 'Play Bug Catcher', 'game play bugs', A.game],
    ['🌟', 'Toggle GOLD mode', 'gold theme', A.gold],
    ['🎉', 'Throw confetti', 'party', A.confetti],
    ['🔍', 'Toggle debug outlines', 'debug', A.debug],
  ];
  let palSel = 0,
    palShown = cmds;
  function fuzzy(q, s) {
    q = q.toLowerCase();
    s = s.toLowerCase();
    if (!q) return 1;
    if (s.includes(q)) return 100 - s.indexOf(q);
    let i = 0;
    for (const ch of s) {
      if (ch === q[i]) i++;
      if (i === q.length) return 10;
    }
    return 0;
  }
  function renderPal() {
    const q = palInput.value.trim();
    palShown = cmds
      .map((c) => ({ c, s: Math.max(fuzzy(q, c[1]), fuzzy(q, c[2])) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.c);
    palSel = Math.min(palSel, Math.max(palShown.length - 1, 0));
    palList.innerHTML = palShown.length
      ? palShown
          .map(
            (c, i) =>
              `<div class="pal-item${i === palSel ? ' sel' : ''}" data-i="${i}"><span class="ic">${c[0]}</span>${esc(c[1])}<span class="hint">${i === palSel ? '↵' : ''}</span></div>`,
          )
          .join('')
      : '<div class="pal-empty">no match — try “work” or “terminal”</div>';
    const s = palList.querySelector('.sel');
    if (s) s.scrollIntoView({ block: 'nearest' });
  }
  function openPal() {
    openOv(palOv);
    palInput.value = '';
    palSel = 0;
    renderPal();
    palInput.focus();
  }
  function runPal(i) {
    const c = palShown[i];
    if (!c) return;
    palOv.classList.remove('open');
    palInput.blur();
    setTimeout(c[3], 120);
  }
  palInput.addEventListener('input', () => {
    palSel = 0;
    renderPal();
  });
  palInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      palSel = Math.min(palSel + 1, palShown.length - 1);
      renderPal();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      palSel = Math.max(palSel - 1, 0);
      renderPal();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runPal(palSel);
    }
  });
  palList.addEventListener('click', (e) => {
    const it = e.target.closest('.pal-item');
    if (it) runPal(+it.dataset.i);
  });
  palList.addEventListener('mousemove', (e) => {
    const it = e.target.closest('.pal-item');
    if (it && +it.dataset.i !== palSel) {
      palSel = +it.dataset.i;
      renderPal();
    }
  });
  ovs.forEach((o) =>
    o.addEventListener('mousedown', (e) => {
      if (e.target === o && o !== caseOv) {
        o.classList.remove('open');
        if (o === gameOv) stopGame();
      }
    }),
  );

  /* ---------- terminal ---------- */
  const files = {
    'about.txt':
      "Rohal Kabir — full-stack developer, Karachi.\nB.Sc. Computer Science, Brock University (Dean's Honor List).\nSoftware Developer I at Pitama Foods (remote, Toronto).",
    'skills.json':
      '{\n  "languages": ["JavaScript","TypeScript","Java","Python","SQL"],\n  "frontend": ["React"],\n  "backend": ["Node.js","Express","Django",".NET"],\n  "data/devops": ["MongoDB","SQL Server","Docker","CI/CD","OpenShift"],\n  "observability": ["OpenTelemetry","Prometheus","Grafana","Jaeger"]\n}',
    'contact.md': 'email: kabirrohal7@gmail.com\nphone: +92 333 2132578\ngithub: github.com/rohal20',
    'secrets.env': 'PERMISSION DENIED 🔒  (nice try)',
  };
  function tp(html) {
    termOut.insertAdjacentHTML('beforeend', html + '\n');
    termOut.scrollTop = termOut.scrollHeight;
  }
  function termInit() {
    termOut.dataset.init = '1';
    tp(
      '<span class="g">Welcome to rohal.dev shell</span> <span class="d">v10.0 — not a real shell, but a surprisingly real developer.</span>',
    );
    tp('type <span class="y">help</span> to see what you can do.\n');
  }
  const termHist = [];
  let hIdx = 0;
  const TC = {
    help: () =>
      tp(
        '<span class="y">commands</span>\n  whoami · ls · cat &lt;file&gt; · projects · experience · skills · contact\n  resume · hire · game · chat · goto &lt;section&gt; · theme · neofetch · clear · exit\n  <span class="d">also: try “sudo hire rohal”, “npm run coffee”, “git log”</span>',
      ),
    whoami: () => tp('visitor — but you could be my next teammate 😉'),
    ls: () =>
      tp(
        Object.keys(files)
          .map((f) => '<span class="p">' + f + '</span>')
          .join('   '),
      ),
    cat: (a) => {
      const f = a[0];
      if (!f) return tp('usage: cat &lt;file&gt;');
      tp(files[f] !== undefined ? esc(files[f]) : 'cat: ' + esc(f) + ': No such file');
    },
    projects: () =>
      tp(
        '<span class="g">AI Incident-Response Copilot</span>  LLM agent over Prometheus/Grafana/Jaeger · up to 90% faster diagnosis\n<span class="g">Car Dealership Platform</span>        React · Django · MongoDB · 100+ listings',
      ),
    experience: () =>
      tp(
        '<span class="y">2025 → now</span>  Software Developer I, Pitama Foods\n<span class="y">2024</span>        Software Dev Intern, E Planet Global (50K+ daily users)',
      ),
    skills: () => tp(esc(files['skills.json'])),
    contact: () => tp(esc(files['contact.md'])),
    resume: () => {
      tp('opening résumé…');
      A.resume();
    },
    hire: () => {
      tp('<span class="g">good call.</span> opening the hire panel…');
      setTimeout(A.hire, 500);
    },
    game: () => {
      tp('launching Bug Catcher 🐛');
      setTimeout(A.game, 400);
    },
    chat: () => {
      tp('pinging Bit…');
      setTimeout(A.chat, 400);
    },
    goto: (a) => {
      const id = (a[0] || '').toLowerCase();
      const m = Object.keys(secLabels).find((k) => k === id || secLabels[k].toLowerCase() === id);
      if (!m) return tp('sections: ' + Object.keys(secLabels).join(', '));
      tp('→ ' + m);
      setTimeout(() => goTo(m), 350);
    },
    theme: () => {
      A.gold();
      tp('theme toggled ✨');
    },
    clear: () => {
      termOut.innerHTML = '';
    },
    exit: () => termOv.classList.remove('open'),
    date: () => tp(new Date().toString()),
    neofetch: () =>
      tp(
        '<span class="y">rohal@portfolio</span>\n<span class="d">-------------</span>\nOS: neo-brutalist 10.0\nHost: Karachi, PK\nShell: rohal.sh\nStack: React · Node · Django · Claude API\nUptime: always shipping\nCoffee: <span class="c">overflow</span>',
      ),
    echo: (a) => tp(esc(a.join(' '))),
    sudo: (a) => {
      if (a.join(' ').toLowerCase().startsWith('hire')) {
        tp('<span class="g">[sudo] permission granted.</span> 🎉');
        burstConfetti(window.innerWidth / 2, window.innerHeight / 2);
        setTimeout(A.hire, 700);
      } else tp('<span class="c">visitor is not in the sudoers file. This incident will be reported.</span>');
    },
    git: (a) => {
      if (a[0] === 'log')
        tp(
          '<span class="y">a1b2c3d</span> ship: 90% faster incident diagnosis\n<span class="y">9f8e7d6</span> fix: orders 20% faster at Pitama\n<span class="y">5c4b3a2</span> feat: DOM → vibes\n<span class="y">0000001</span> init: hello world',
        );
      else tp('git: try “git log”');
    },
    npm: (a) => {
      if (a.join(' ') === 'run coffee') tp('☕ brewing… <span class="g">done</span> (productivity +12%)');
      else tp('npm ERR! try “npm run coffee”');
    },
    coffee: () => tp('☕ one coffee, coming up'),
    ping: () => tp('PONG — response time: 0ms (available for work)'),
  };
  termIn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const raw = termIn.value.trim();
      termIn.value = '';
      if (!raw) return;
      termHist.push(raw);
      hIdx = termHist.length;
      tp('<span class="g">visitor@rohal.dev:~$</span> ' + esc(raw));
      const parts = raw.split(/\s+/),
        cmd = parts[0].toLowerCase();
      if (TC[cmd]) TC[cmd](parts.slice(1));
      else
        tp('<span class="c">command not found:</span> ' + esc(cmd) + '  <span class="d">(try help)</span>');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (hIdx > 0) {
        hIdx--;
        termIn.value = termHist[hIdx] || '';
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (hIdx < termHist.length - 1) {
        hIdx++;
        termIn.value = termHist[hIdx];
      } else {
        hIdx = termHist.length;
        termIn.value = '';
      }
    }
  });

  /* ---------- Bit chat (+ optional voice) ---------- */
  let voiceOn = false;
  const kb = [
    {
      k: ['hi', 'hello', 'hey', 'yo', 'sup'],
      a: "Hey! 👋 I'm Bit, Rohal's site assistant. Ask about his experience, projects, skills, or how to reach him.",
    },
    {
      k: ['who', 'rohal', 'about', 'yourself', 'intro'],
      a: "Rohal Kabir is a full-stack developer from Karachi who builds React & Node apps, then instruments them so nothing breaks quietly. He's a Software Developer I at Pitama Foods.",
    },
    {
      k: ['experience', 'work', 'job', 'pitama', 'career', 'employ', 'role'],
      a: 'Currently <b>Software Developer I at Pitama Foods</b> (Jan 2025 → now, remote): internal SPA tooling with React, TypeScript, Node.js — orders +20% faster, manual entry −40%, support tickets −25%. Before that, a software dev internship at E Planet Global.',
    },
    {
      k: ['intern', 'planet', 'e planet', '2024'],
      a: 'At <b>E Planet Global</b> (May–Dec 2024) he built full-stack features with React, Django and .NET for 50,000+ daily users, cutting bugs 35% and API response time 30%.',
    },
    {
      k: ['project', 'projects', 'built', 'build', 'side'],
      a: 'Two highlights: the <b>AI Incident-Response Copilot</b> (an LLM agent over Prometheus, Grafana & Jaeger — up to 90% faster diagnosis) and a <b>Car Dealership platform</b> (React, Django, MongoDB, 100+ listings). Try the Work section — click a card for the full story.',
    },
    {
      k: ['copilot', 'ai', 'incident', 'claude', 'llm', 'agent', 'observability'],
      a: 'The AI Incident-Response Copilot uses the Claude API with an adapter layer to correlate Prometheus metrics, Grafana dashboards and Jaeger traces, then explains incidents in plain English. Up to 90% faster diagnosis.',
    },
    {
      k: ['car', 'dealership', 'mongodb'],
      a: 'The Car Dealership platform: React, Express, Django and MongoDB with advanced search & filtering over 100+ vehicle listings, deployed on OpenShift with CI/CD.',
    },
    {
      k: [
        'skill',
        'skills',
        'stack',
        'tech',
        'technology',
        'language',
        'languages',
        'react',
        'node',
        'python',
        'java',
      ],
      a: 'JavaScript, TypeScript, Java, Python, SQL · React · Node/Express, Django, .NET · MongoDB, SQL Server · Docker, CI/CD, OpenShift · OpenTelemetry, Prometheus, Grafana, Jaeger.',
    },
    {
      k: ['education', 'school', 'university', 'brock', 'degree', 'study', 'studied', 'gpa'],
      a: "B.Sc. in Computer Science (Software Engineering concentration) from Brock University — graduated on the Dean's Honor List. Plus the IBM Full Stack Developer professional certificate (2025).",
    },
    {
      k: ['certificate', 'certification', 'ibm', 'coursera'],
      a: 'IBM Full Stack Developer Professional Certificate, completed in July 2025 alongside his full-time role.',
    },
    {
      k: ['contact', 'email', 'mail', 'reach', 'phone', 'call', 'number', 'touch'],
      a: "📧 <a href='mailto:kabirrohal7@gmail.com'>kabirrohal7@gmail.com</a><br>📞 +92 333 2132578<br>🐙 <a href='https://github.com/rohal20' target='_blank' rel='noopener'>github.com/rohal20</a>",
    },
    {
      k: ['resume', 'cv', 'pdf', 'download'],
      a: "Here you go — <a href='Rohal_Kabir_Resume.pdf' target='_blank'>open the résumé (PDF)</a>.",
    },
    {
      k: ['hire', 'available', 'availability', 'open', 'looking', 'freelance', 'opportunity'],
      a: 'Rohal is open to work and remote roles. The fastest way: email him or hit <b>H</b> on your keyboard for the “why hire me” panel. 🚀',
    },
    {
      k: ['where', 'location', 'karachi', 'pakistan', 'toronto', 'remote', 'timezone'],
      a: "Based in Karachi, Pakistan, working remotely with a Toronto-based team. He's comfortable with distributed collaboration.",
    },
    {
      k: ['github', 'repo', 'repos', 'code', 'source'],
      a: "Everything's at <a href='https://github.com/rohal20' target='_blank' rel='noopener'>github.com/rohal20</a> — the GitHub section above even pulls live activity.",
    },
    {
      k: ['game', 'play', 'fun', 'bored'],
      a: 'Try the mini-game: press Ctrl+K and pick “Play Bug Catcher” 🐛',
    },
    {
      k: ['terminal', 'shell', 'command', 'palette', 'easter', 'secret'],
      a: 'Press <b>`</b> for a hidden terminal, <b>Ctrl/⌘+K</b> for the command palette, and try the Konami code. 😉',
    },
    {
      k: ['bit', 'you', 'mascot', 'robot', 'name'],
      a: "I'm Bit — a very small robot with a very large opinion about clean code. 🤖",
    },
    {
      k: ['thanks', 'thank', 'cool', 'nice', 'awesome', 'great'],
      a: 'Anytime! If you like what you see, the contact section is one click away. ✌️',
    },
  ];
  function answer(q) {
    const toks = q
      .toLowerCase()
      .replace(/[^a-z0-9+#. ]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
    let best = null,
      bs = 0;
    kb.forEach((it) => {
      let s = 0;
      toks.forEach((t) => {
        if (t.length < 2) return;
        it.k.forEach((k) => {
          if (t === k) s += 3;
          else if (t.length > 3 && (k.startsWith(t) || t.startsWith(k))) s += 1.5;
        });
      });
      if (s > bs) {
        bs = s;
        best = it;
      }
    });
    return best
      ? best.a
      : "Hmm, I don't have that one — I only know what's on Rohal's résumé. Try asking about his <b>experience</b>, <b>projects</b>, <b>skills</b> or <b>contact</b> info.";
  }
  function speak(html) {
    if (!voiceOn || !('speechSynthesis' in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(html.replace(/<[^>]+>/g, ' '));
      u.rate = 1.05;
      u.pitch = 1.3;
      speechSynthesis.speak(u);
    } catch (e) {}
  }
  function addMsg(cls, html) {
    const d = document.createElement('div');
    d.className = 'msg ' + cls;
    d.innerHTML = html;
    chatLog.appendChild(d);
    chatLog.scrollTop = chatLog.scrollHeight;
    return d;
  }
  function botReply(q) {
    const t = document.createElement('div');
    t.className = 'msg bot typing';
    t.innerHTML = '<i></i><i></i><i></i>';
    chatLog.appendChild(t);
    chatLog.scrollTop = chatLog.scrollHeight;
    setTimeout(
      () => {
        t.remove();
        const a = answer(q);
        addMsg('bot', a);
        speak(a);
        if (window.__sfx) window.__sfx.blip();
      },
      450 + Math.random() * 450,
    );
  }
  function chatSend(q) {
    q = q.trim();
    if (!q) return;
    addMsg('me', esc(q));
    botReply(q);
  }
  function greetingLine() {
    const h = new Date().getHours();
    const g =
      h < 5
        ? 'burning the midnight oil?'
        : h < 12
          ? 'good morning!'
          : h < 17
            ? 'good afternoon!'
            : h < 21
              ? 'good evening!'
              : 'working late?';
    return g + ' I’m Bit 👋';
  }
  let chatInit = false;
  function openChat() {
    if (window.__ach) window.__ach('chat');
    ovs.forEach((o) => o.classList.remove('open'));
    chatEl.classList.add('open');
    document.body.classList.add('chat-open');
    chatFab.style.display = 'none';
    if (!chatInit) {
      chatInit = true;
      const g = greetingLine() + " Tap a topic below and I'll fill you in.";
      addMsg('bot', g);
      [
        ['💼 Experience', 'experience'],
        ['🛠 Projects', 'projects'],
        ['🧰 Skills', 'skills'],
        ['🎓 Education', 'education'],
        ['📜 Certificate', 'certificate'],
        ['🤖 AI Copilot', 'copilot'],
        ['🚗 Car Dealership', 'car dealership'],
        ['📍 Where is he?', 'location'],
        ['📄 Résumé', 'resume'],
        ['📬 Contact', 'contact'],
        ['🤝 Hire him', 'hire'],
        ['🎮 Play a game', 'game'],
        ['⌨️ Secrets', 'secret'],
        ['🙋 Who are you?', 'bit'],
      ].forEach(([l, q]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = l;
        b.onclick = () => {
          addMsg('me', esc(l));
          botReply(q);
        };
        chatChips.appendChild(b);
      });
    }
  }
  function closeChat() {
    chatEl.classList.remove('open');
    document.body.classList.remove('chat-open');
    chatFab.style.display = '';
    try {
      speechSynthesis.cancel();
    } catch (e) {}
  }
  chatFab.addEventListener('click', openChat);
  $('chatX').addEventListener('click', closeChat);
  $('chatSnd').addEventListener('click', () => {
    voiceOn = !voiceOn;
    $('chatSnd').textContent = voiceOn ? '🔊' : '🔇';
    if (voiceOn) speak(greetingLine() + ' Voice is on.');
    else
      try {
        speechSynthesis.cancel();
      } catch (e) {}
  });
  if (mascot) mascot.addEventListener('dblclick', openChat);

  /* ---------- Bug Catcher mini-game ---------- */
  const gc = $('gameCanvas'),
    g = gc.getContext('2d');
  const GW = gc.width,
    GH = gc.height;
  let G = null,
    gRaf = 0;
  $('gBest').textContent = 'best ' + parseInt(lsGet('rk-bug-best') || '0', 10);
  function startGame() {
    cancelAnimationFrame(gRaf);
    G = {
      x: GW / 2,
      tx: GW / 2,
      items: [],
      score: 0,
      lives: 3,
      t: 30,
      spawn: 0,
      last: performance.now(),
      over: false,
      flash: 0,
    };
    gRaf = requestAnimationFrame(gameTick);
  }
  function stopGame() {
    cancelAnimationFrame(gRaf);
    G = null;
  }
  function gameTick(now) {
    if (!G) return;
    const dt = Math.min((now - G.last) / 1000, 0.05);
    G.last = now;
    if (!G.over) {
      G.t -= dt;
      G.x += (G.tx - G.x) * Math.min(1, dt * 14);
      G.spawn -= dt;
      if (G.spawn <= 0) {
        G.spawn = 0.42 - Math.min(0.2, (30 - G.t) * 0.007);
        const r = Math.random();
        G.items.push({
          x: 30 + Math.random() * (GW - 60),
          y: -20,
          v: 150 + Math.random() * 130 + (30 - G.t) * 4,
          t: r < 0.62 ? 'b' : r < 0.9 ? 'f' : 'c',
          rot: Math.random() * 6,
        });
      }
      G.items.forEach((it) => {
        it.y += it.v * dt;
      });
      G.items = G.items.filter((it) => {
        const hit = it.y > GH - 90 && it.y < GH - 20 && Math.abs(it.x - G.x) < 42;
        if (hit) {
          if (it.t === 'b') {
            G.score++;
            if (window.__sfx) window.__sfx.tick();
          } else if (it.t === 'c') {
            G.score += 5;
          } else {
            G.lives--;
            G.flash = 0.25;
          }
          return false;
        }
        return it.y < GH + 30;
      });
      if (G.flash > 0) G.flash -= dt;
      if (G.t <= 0 || G.lives <= 0) {
        G.over = true;
        G.t = Math.max(G.t, 0);
        const best = Math.max(G.score, parseInt(lsGet('rk-bug-best') || '0', 10));
        lsSet('rk-bug-best', best);
        $('gBest').textContent = 'best ' + best;
        if (G.score >= 15) burstConfetti(window.innerWidth / 2, window.innerHeight / 2);
      }
    }
    $('gScore').textContent = 'score ' + G.score + ' · ' + '♥'.repeat(Math.max(G.lives, 0));
    $('gTime').textContent = Math.ceil(G.t) + 's';
    drawGame();
    gRaf = requestAnimationFrame(gameTick);
  }
  function drawGame() {
    g.fillStyle = G.flash > 0 ? '#FF5A5F' : '#3B4CFF';
    g.fillRect(0, 0, GW, GH);
    g.fillStyle = 'rgba(11,11,15,.18)';
    for (let x = 0; x < GW; x += 30) for (let y = 0; y < GH; y += 30) g.fillRect(x, y, 2, 2);
    g.font = '30px serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    G.items.forEach((it) => {
      g.save();
      g.translate(it.x, it.y);
      g.rotate(Math.sin(it.y / 40 + it.rot) * 0.4);
      g.fillText(it.t === 'b' ? '🐛' : it.t === 'f' ? '🔥' : '☕', 0, 0);
      g.restore();
    });
    const bx = G.x,
      by = GH - 70;
    g.lineWidth = 5;
    g.strokeStyle = '#0B0B0F';
    g.fillStyle = '#FFD23F';
    g.beginPath();
    g.roundRect(bx - 34, by - 26, 68, 56, 14);
    g.fill();
    g.stroke();
    g.fillStyle = '#fff';
    [
      [-14, -4],
      [14, -4],
    ].forEach(([ox, oy]) => {
      g.beginPath();
      g.arc(bx + ox, by + oy, 9, 0, 6.3);
      g.fill();
      g.lineWidth = 3.5;
      g.stroke();
    });
    g.fillStyle = '#0B0B0F';
    const look = Math.max(-3, Math.min(3, (G.tx - G.x) / 12));
    [
      [-14, -4],
      [14, -4],
    ].forEach(([ox, oy]) => {
      g.beginPath();
      g.arc(bx + ox + look, by + oy + 1, 3.5, 0, 6.3);
      g.fill();
    });
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(bx - 9, by + 15);
    g.quadraticCurveTo(bx, by + 22, bx + 9, by + 15);
    g.stroke();
    g.beginPath();
    g.moveTo(bx, by - 26);
    g.lineTo(bx, by - 40);
    g.stroke();
    g.fillStyle = '#FF5A5F';
    g.beginPath();
    g.arc(bx, by - 42, 6, 0, 6.3);
    g.fill();
    g.lineWidth = 3;
    g.stroke();
    if (G.over) {
      g.fillStyle = 'rgba(11,11,15,.82)';
      g.fillRect(0, 0, GW, GH);
      g.fillStyle = '#FFD23F';
      g.font = '72px Anton, Impact, sans-serif';
      g.fillText(G.lives <= 0 ? 'PROD IS DOWN' : 'SHIFT OVER', GW / 2, GH / 2 - 50);
      g.fillStyle = '#fff';
      g.font = '700 20px monospace';
      g.fillText('score ' + G.score + (G.score >= 15 ? '  —  hire this person 😎' : ''), GW / 2, GH / 2 + 14);
      g.fillText('click or press Enter to play again', GW / 2, GH / 2 + 52);
    }
  }
  function gamePointer(e) {
    if (!G) return;
    const r = gc.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    G.tx = Math.max(34, Math.min(GW - 34, ((cx - r.left) / r.width) * GW));
  }
  gc.addEventListener('mousemove', gamePointer);
  gc.addEventListener(
    'touchmove',
    (e) => {
      gamePointer(e);
      e.preventDefault();
    },
    { passive: false },
  );
  gc.addEventListener('touchstart', gamePointer, { passive: true });
  gc.addEventListener('click', () => {
    if (G && G.over) startGame();
  });
  $('gameX').addEventListener('click', () => {
    gameOv.classList.remove('open');
    stopGame();
  });

  /* ---------- case studies ---------- */
  const caseWrap = $('caseWrap'),
    caseBox = $('caseBox');
  const diagram = `<div class="case-diagram"><h3>$ architecture — how the copilot thinks</h3>
    <svg viewBox="0 0 760 250" role="img" aria-label="Architecture diagram">
      <g font-family="IBM Plex Mono" font-weight="700" font-size="13" text-anchor="middle">
        <rect x="10" y="20" width="150" height="48" rx="10" fill="#FF5A5F" stroke="#fff" stroke-width="3"/><text x="85" y="49" fill="#0B0B0F">Prometheus</text>
        <rect x="10" y="100" width="150" height="48" rx="10" fill="#FFD23F" stroke="#fff" stroke-width="3"/><text x="85" y="129" fill="#0B0B0F">Grafana</text>
        <rect x="10" y="180" width="150" height="48" rx="10" fill="#8FE24B" stroke="#fff" stroke-width="3"/><text x="85" y="209" fill="#0B0B0F">Jaeger traces</text>
        <rect x="270" y="80" width="170" height="88" rx="14" fill="#B892FF" stroke="#fff" stroke-width="3"/><text x="355" y="118" fill="#0B0B0F">Adapter layer</text><text x="355" y="140" fill="#0B0B0F" font-size="11">normalise signals</text>
        <rect x="560" y="80" width="190" height="88" rx="14" fill="#fff" stroke="#fff" stroke-width="3"/><text x="655" y="118" fill="#0B0B0F">Claude agent</text><text x="655" y="140" fill="#0B0B0F" font-size="11">root cause, plain English</text>
      </g>
      <g fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round">
        <path class="flow" d="M160 44 C215 44 215 110 270 116"/><path class="flow" d="M160 124 L270 124"/><path class="flow" d="M160 204 C215 204 215 138 270 132"/><path class="flow" d="M440 124 L560 124"/>
      </g>
      <circle r="6" fill="#FFD23F"><animateMotion dur="2.4s" repeatCount="indefinite" path="M160 124 L270 124 L440 124 L560 124"/></circle>
    </svg></div>`;
  /* The story behind each card. Edit the text here; it is the same material as the Build Log notes. */
  const CASE_STORY = {
    INCIDENT: {
      problem: 'When something breaks you tab-switch between Prometheus (metrics), Grafana (dashboards) and Jaeger (traces) and correlate by eye. It is slow, and it happens at the worst possible time.',
      approach: 'A thin adapter layer normalises each source into one shape, so the agent can reason over metrics and traces together. The Claude API turns the correlated signals into a plain-English explanation.',
      lesson: 'The model was not the hard part. Clean, comparable inputs were.',
    },
    PITAMA: {
      problem: 'Reps were re-typing the same numbers into three systems, and orders could get lost in email threads.',
      approach: 'An internal SPA for catalog, inventory and wholesale orders on top of one integrated API, so every number is entered once.',
      lesson: 'Stop patching symptoms. Asking why the same ticket keeps coming back found shared root causes.',
    },
    PLANET: {
      problem: 'Features serving 50,000+ daily users meant regressions had real, immediate cost.',
      approach: 'Unit and integration tests for each data-driven feature before release, plus a pass on slow API calls.',
      lesson: 'Boring discipline measurably beats 11pm fire drills.',
    },
    DEALERSHIP: {
      problem: 'A listings site is only useful if a buyer can narrow 100+ vehicles down quickly.',
      approach: 'A React front end with advanced search and filtering, backed by Express.js and Django services and MongoDB, shipped through CI/CD on OpenShift.',
      lesson: 'Search and filter UX is the product; the listing data is just the raw material.',
    },
  };
  function storyHtml(nm) {
    const key = Object.keys(CASE_STORY).find((k) => new RegExp(k, 'i').test(nm));
    if (!key) return '';
    const s = CASE_STORY[key];
    const box = (t, x) => `<div class="case-sb"><h3>${t}</h3><p>${esc(x)}</p></div>`;
    return `<div class="case-story">${box('The problem', s.problem)}${box('The approach', s.approach)}${box('The lesson', s.lesson)}</div>`;
  }
  function openCase(card) {
    const nm = card.querySelector('.work-card-name').innerHTML.replace(/<br\s*\/?>/gi, ' ');
    const vis = card.querySelector('.work-card-visual');
    const col = vis ? vis.style.background || 'var(--yellow)' : 'var(--yellow)';
    const lbl = card.querySelector('.lbl'),
      val = card.querySelector('.val'),
      p = card.querySelector('.work-card-info p');
    const stats = Array.from(card.querySelectorAll('.work-stats span')).map((s) => s.textContent.trim());
    const tags = Array.from(card.querySelectorAll('.work-tags span')).map((s) => s.textContent);
    const statHtml = stats
      .map((s) => {
        const m = s.match(/^([+\-−]?)(\d+)(K?\+?)(%?)\s+(.*)$/);
        return m
          ? `<div class="case-stat"><b data-n="${m[2]}" data-pre="${m[1]}" data-suf="${m[3] + m[4]}">${m[1]}0${m[3] + m[4]}</b><span>${esc(m[5])}</span></div>`
          : `<div class="case-stat"><b>★</b><span>${esc(s)}</span></div>`;
      })
      .join('');
    const isCopilot = /INCIDENT/i.test(nm);
    caseWrap.innerHTML = `<div class="case-kicker">${esc(lbl ? lbl.textContent : '')} · ${esc(val ? val.textContent : '')}</div><h2 class="case-title">${nm}</h2><p class="case-lead">${esc(p ? p.textContent : '')}</p><div class="case-stats">${statHtml}</div><div class="case-tags">${tags.map((t) => `<span>${esc(t)}</span>`).join('')}</div>${storyHtml(nm)}${isCopilot ? '<div class="case-media" id="caseMedia"></div>' + diagram : ''}`;
    caseBox.style.background = col;
    caseBox.scrollTop = 0;
    openOv(caseOv);
    if (isCopilot && window.__loadCaseMedia) window.__loadCaseMedia();
    caseWrap.querySelectorAll('.case-stat b[data-n]').forEach((b) => {
      const o = { v: 0 },
        n = +b.dataset.n;
      gsap.to(o, {
        v: n,
        duration: 1.2,
        delay: 0.5,
        ease: 'power3.out',
        onUpdate: () => {
          b.textContent = b.dataset.pre + Math.round(o.v) + b.dataset.suf;
        },
      });
    });
    if (!reduceMotion)
      gsap.from('#caseWrap > *', {
        y: 40,
        opacity: 0,
        duration: 0.6,
        stagger: 0.08,
        delay: 0.35,
        ease: 'power3.out',
      });
  }
  let cdx = 0,
    cdown = 0;
  workCards.forEach((card) => {
    card.addEventListener('pointerdown', (e) => {
      cdx = e.clientX;
      cdown = Date.now();
    });
    card.addEventListener('click', (e) => {
      if (e.target.closest('a,button')) return;
      if (Math.abs(e.clientX - cdx) > 6) return;
      openCase(card);
    });
  });
  workCards.forEach((card) => {
    const nmTxt = card.querySelector('.work-card-name').textContent.replace(/\s+/g, ' ').trim();
    card.setAttribute('aria-label', 'Open case study: ' + nmTxt);
    card.addEventListener('keydown', (e) => {
      if (e.target !== card) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openCase(card);
      }
    });
  });
  $('caseX').addEventListener('click', () => caseOv.classList.remove('open'));

  /* ---------- global keys (capture, so they win over the older handler) ---------- */
  document.addEventListener(
    'keydown',
    (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      const typing = tag === 'input' || tag === 'textarea';
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        e.stopImmediatePropagation();
        palOv.classList.contains('open') ? palOv.classList.remove('open') : openPal();
        return;
      }
      if (e.key === 'Escape') {
        closeOvs();
        closeChat();
        return;
      }
      if (typing) return;
      if (e.key === '`' || (e.key === '/' && !e.shiftKey)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        e.key === '`' ? A.term() : openPal();
        return;
      }
      if (gameOv.classList.contains('open')) {
        e.stopImmediatePropagation();
        if (!G) return;
        if (e.key === 'Enter' && G.over) startGame();
        if (e.key === 'ArrowLeft') G.tx = Math.max(34, G.tx - 90);
        if (e.key === 'ArrowRight') G.tx = Math.min(GW - 34, G.tx + 90);
      }
    },
    true,
  );

  /* ---------- time-aware greeting + discoverability hints ---------- */
  setTimeout(() => {
    if (!anyOv()) mascotSay('psst… press Ctrl+K ✨', 3600);
  }, 11000);

  /* =====================================================================
     v11: sound, resume stamp sparks, contact delivery, GitHub block,
     case-study media, load failsafe
     ===================================================================== */

  /* ---------- load failsafe: never leave a visitor on a stuck loader ---------- */
  setTimeout(() => {
    if (!window.__heroPlayed) {
      [loader, panelTop, panelBottom].forEach((el) => {
        if (el) el.style.display = 'none';
      });
      try {
        playHeroIntro();
      } catch (e) {}
    }
  }, 9000);

  /* ---------- Web3Forms delivery (paste your free key from web3forms.com) ---------- */
  const WEB3FORMS_KEY = '';
  window.__sendContact = function (name, email, msg, resp) {
    const line = (t) => {
      const d = document.createElement('div');
      d.textContent = t;
      resp.appendChild(d);
    };
    const mailFallback = () => {
      const subject = encodeURIComponent('Portfolio contact from ' + name);
      const body = encodeURIComponent(msg + '\n\n— ' + name + ' (' + email + ')');
      window.location.href = 'mailto:kabirrohal7@gmail.com?subject=' + subject + '&body=' + body;
    };
    if (!WEB3FORMS_KEY) {
      line('> opening your mail client...');
      mailFallback();
      return;
    }
    const bot = document.getElementById('cf-bot');
    fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        access_key: WEB3FORMS_KEY,
        name,
        email,
        message: msg,
        subject: 'Portfolio message from ' + name,
        from_name: 'rohal.dev',
        botcheck: bot && bot.checked ? 'on' : '',
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) throw new Error('rejected');
        line('> ✓ delivered. Rohal will reply soon.');
        form.reset();
        burstConfetti(window.innerWidth / 2, window.innerHeight * 0.6);
        if (window.__sfx) window.__sfx.pop();
      })
      .catch(() => {
        line('> network hiccup — opening mail client instead');
        setTimeout(mailFallback, 600);
      });
  };
  (function () {
    const h = document.createElement('input');
    h.type = 'checkbox';
    h.id = 'cf-bot';
    h.tabIndex = -1;
    h.setAttribute('aria-label', 'Leave this field empty');
    h.setAttribute('aria-hidden', 'true');
    h.autocomplete = 'off';
    h.style.cssText = 'position:absolute;left:-9999px;opacity:0;';
    form.appendChild(h);
  })();

  /* ---------- sound design (WebAudio, synthesized, off by default) ---------- */
  let AC = null,
    sndOn = false,
    lastTickT = 0;
  function actx() {
    if (!AC) {
      try {
        AC = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {}
    }
    if (AC && AC.state === 'suspended') AC.resume();
    return AC;
  }
  function tone(freq, dur, type, vol, toFreq) {
    if (!sndOn) return;
    const c = actx();
    if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator(),
      g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (toFreq) o.frequency.exponentialRampToValueAtTime(toFreq, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.04, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  function whoosh(vol) {
    if (!sndOn) return;
    const c = actx();
    if (!c) return;
    const t = c.currentTime,
      d = 0.45;
    const buf = c.createBuffer(1, c.sampleRate * d, c.sampleRate),
      data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(2600, t + d * 0.7);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.07, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(f).connect(g).connect(c.destination);
    src.start(t);
  }
  window.__sfx = {
    tick: () => {
      const n = performance.now();
      if (n - lastTickT < 60) return;
      lastTickT = n;
      tone(1100, 0.04, 'square', 0.018);
    },
    pop: () => tone(420, 0.12, 'triangle', 0.07, 820),
    blip: () => tone(660, 0.08, 'sine', 0.05, 990),
    section: () => {
      tone(520, 0.09, 'triangle', 0.05);
      setTimeout(() => tone(780, 0.11, 'triangle', 0.05), 70);
    },
    whoosh: (v) => whoosh(v),
  };
  const sndBtn = document.createElement('button');
  sndBtn.className = 'snd-btn';
  sndBtn.setAttribute('aria-pressed', 'false');
  sndBtn.setAttribute('aria-label', 'Sound effects: sound off');
  sndBtn.innerHTML = '<span class="snd-bars"><i></i><i></i><i></i></span><span id="sndTxt">sound off</span>';
  document.body.appendChild(sndBtn);
  sndBtn.addEventListener('click', () => {
    sndOn = !sndOn;
    sndBtn.setAttribute('aria-pressed', String(sndOn));
    document.getElementById('sndTxt').textContent = sndOn ? 'sound on' : 'sound off';
    sndBtn.setAttribute('aria-label', 'Sound effects: ' + (sndOn ? 'sound on' : 'sound off'));
    if (sndOn) {
      actx();
      window.__sfx.pop();
      if (window.__ach) window.__ach('sound');
      showToast('🔊 sound on — soft clicks & whooshes', 2400);
    }
  });
  document.addEventListener('mouseover', (e) => {
    if (!sndOn) return;
    const t = e.target.closest
      ? e.target.closest(
          '.nb-btn,.nav-links a,.nav-cta,.work-card,.gh-card,.stack-panel,.contact-link,.pal-item,.chips button,.resume-stamp,.snd-btn,.chat-fab',
        )
      : null;
    if (t && t !== document._lastSndT) {
      document._lastSndT = t;
      window.__sfx.tick();
    } else if (!t) {
      document._lastSndT = null;
    }
  });
  document.addEventListener('click', (e) => {
    if (sndOn && e.target.closest && e.target.closest('button,a')) window.__sfx.pop();
  });
  /* scroll-driven: soft whoosh on fast scrolling, chime when a new section takes over */
  (function () {
    let last = currentScroll,
      lastW = 0,
      curSec = null;
    const secEls = Array.from(document.querySelectorAll('section[id]'));
    setInterval(() => {
      if (!sndOn) {
        last = currentScroll;
        return;
      }
      const dv = Math.abs(currentScroll - last);
      last = currentScroll;
      const now = performance.now();
      if (dv > 14 && now - lastW > 650) {
        lastW = now;
        whoosh(Math.min(0.09, 0.03 + dv / 900));
      }
      let cs = null;
      secEls.forEach((s, i) => {
        if (layout.tops[i] - currentScroll < window.innerHeight * 0.45) cs = s.id;
      });
      if (cs && cs !== curSec) {
        if (curSec !== null) window.__sfx.section();
        curSec = cs;
      }
    }, 90);
  })();

  /* ---------- live GitHub block: always-on career log + API heatmap & languages ---------- */
  (function () {
    const old = document.querySelector('.gh-live');
    if (old) old.remove();
    const grid = $('ghGrid');
    if (!grid) return;
    const blk = document.createElement('div');
    blk.className = 'gh-live';
    blk.innerHTML =
      '<div id="ghHeatWrap" hidden><h3><span id="ghHeatTitle">$ git log</span><span>live · GitHub API</span></h3><div class="gh-grid-heat" id="ghHeat"></div><div class="gh-heat-legend" id="ghHeatNote"></div><div class="gh-lang-bar" id="ghLangBar"></div><div class="gh-lang-legend" id="ghLangLegend"></div></div>' +
      '<div><h3><span>$ tail -f career.log</span><span class="live-dot">● live</span></h3><div class="gh-log-body" id="ghLog"></div></div>';
    grid.parentNode.insertBefore(blk, grid);
    const lines = [
      ['ok', '✓ 2025  shipped SPA tooling at Pitama Foods → orders +20% faster'],
      ['ok', '✓ 2025  manual data entry −40%, support tickets −25%'],
      ['ok', '✓ 2025  IBM Full Stack Developer certificate earned'],
      ['ok', '✓ 2024  E Planet Global: features used by 50K+ people daily'],
      ['ok', '✓ 2024  bugs −35%, API response time −30%'],
      ['ok', '✓ grad  B.Sc. Computer Science, Dean’s Honor List'],
      ['now', '● now   building: AI incident copilot (Claude API + OpenTelemetry)'],
    ];
    const log = $('ghLog');
    let li = 0,
      started = false;
    function addLine() {
      const [c, t] = lines[li % lines.length];
      li++;
      const d = document.createElement('div');
      d.className = c;
      d.textContent = t;
      log.appendChild(d);
      while (log.children.length > 7) log.removeChild(log.firstChild);
    }
    function startLog() {
      if (started) return;
      started = true;
      if (reduceMotion) {
        lines.forEach(() => addLine());
        return;
      }
      addLine();
      const iv = setInterval(() => {
        addLine();
      }, 1500);
    }
    new IntersectionObserver(
      (en, ob) => {
        if (en[0].isIntersecting) {
          startLog();
          ob.disconnect();
        }
      },
      { threshold: 0.3 },
    ).observe(blk);

    Promise.all([
      fetch('https://api.github.com/users/rohal20').then((r) => (r.ok ? r.json() : Promise.reject())),
      fetch('https://api.github.com/users/rohal20/events/public?per_page=100').then((r) =>
        r.ok ? r.json() : Promise.reject(),
      ),
      fetch('https://api.github.com/users/rohal20/repos?per_page=100').then((r) =>
        r.ok ? r.json() : Promise.reject(),
      ),
    ])
      .then(([user, events, repos]) => {
        const st = document.querySelector('.gh-stat');
        if (st && user.public_repos != null) st.textContent = user.public_repos + ' PUBLIC REPOS';
        const days = {};
        let total = 0;
        events.forEach((ev) => {
          if (ev.type === 'PushEvent') {
            const d = ev.created_at.slice(0, 10);
            const n = (ev.payload && ev.payload.size) || 1;
            days[d] = (days[d] || 0) + n;
            total += n;
          }
        });
        const WEEKS = 22,
          today = new Date();
        today.setHours(12, 0, 0, 0);
        const start = new Date(today);
        start.setDate(start.getDate() - (WEEKS * 7 - 1) - today.getDay() + 6);
        const cells = [];
        for (let i = 0; i < WEEKS * 7; i++) {
          const d = new Date(start);
          d.setDate(start.getDate() + i);
          if (d > today) break;
          const k = d.toISOString().slice(0, 10);
          const n = days[k] || 0;
          cells.push(
            '<i class="pop ' +
              (n ? 'l' + Math.min(4, Math.ceil(n / 2)) : '') +
              '" title="' +
              k +
              ': ' +
              n +
              ' commit' +
              (n === 1 ? '' : 's') +
              '" style="animation-delay:' +
              i * 7 +
              'ms"></i>',
          );
        }
        $('ghHeat').innerHTML = cells.join('');
        $('ghHeatTitle').textContent = '$ git log → ' + total + ' recent public commits';
        $('ghHeatNote').textContent = 'GitHub only exposes ~90 days of public push events';
        const langs = {};
        repos.forEach((r) => {
          if (r.language && !r.fork) langs[r.language] = (langs[r.language] || 0) + 1;
        });
        const entries = Object.entries(langs)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5),
          sum = entries.reduce((a, b) => a + b[1], 0) || 1;
        const cols = ['#FFD23F', '#FF5A5F', '#8FE24B', '#B892FF', '#FDFDF9'];
        $('ghLangBar').innerHTML = entries
          .map((e, i) => '<i style="width:' + (e[1] / sum) * 100 + '%;background:' + cols[i] + '"></i>')
          .join('');
        $('ghLangLegend').innerHTML = entries
          .map(
            (e, i) =>
              '<span><b style="background:' +
              cols[i] +
              '"></b>' +
              esc(e[0]) +
              ' ' +
              Math.round((e[1] / sum) * 100) +
              '%</span>',
          )
          .join('');
        $('ghHeatWrap').hidden = false;
        blk.classList.add('has-heat');
        ScrollTrigger.refresh();
      })
      .catch(() => {});
  })();

  /* ---------- case-study media: real screenshot/video if present, else an honest animated mock ---------- */
  function mockDashboard() {
    return (
      '<div class="frame"><div class="frame-bar"><i style="background:#FF5A5F"></i><i style="background:#FFD23F"></i><i style="background:#8FE24B"></i>&nbsp; incident-copilot · checkout-service · last 15m</div>' +
      '<div class="mock-grid">' +
      '<div class="mp"><h3>p99 latency (ms)</h3><svg viewBox="0 0 300 110"><path class="ln" fill="none" stroke="#8FE24B" stroke-width="3" stroke-linejoin="round" d="M0,86 L30,84 L60,88 L90,82 L120,85 L150,80 L180,30 L200,12 L225,34 L250,70 L275,76 L300,74"/><circle class="spike" cx="200" cy="12" r="5" fill="#FF5A5F"/></svg></div>' +
      '<div class="mp"><h3>error rate</h3><div class="bars">' +
      [8, 10, 9, 12, 11, 46, 88, 64, 30, 14, 10, 9]
        .map(
          (h, i) =>
            '<i style="height:' +
            h +
            '%;animation-delay:' +
            i * 60 +
            'ms;' +
            (h > 40 ? '' : 'background:#4b4b66') +
            '"></i>',
        )
        .join('') +
      '</div></div>' +
      '<div class="mp wide"><h3>trace waterfall</h3><div class="wf">' +
      [
        ['0', '100', '#B892FF'],
        ['6', '30', '#FFD23F'],
        ['30', '62', '#FF5A5F'],
        ['36', '10', '#8FE24B'],
        ['70', '24', '#FFD23F'],
      ]
        .map(
          (r, i) =>
            '<div><b style="left:' +
            r[0] +
            '%;width:' +
            r[1] +
            '%;background:' +
            r[2] +
            ';animation-delay:' +
            i * 180 +
            'ms"></b></div>',
        )
        .join('') +
      '</div></div>' +
      '<div class="mp wide"><h3>🤖 copilot</h3><div class="agent-txt" id="mockAgent"></div></div>' +
      '</div><div class="mock-note">Illustrative mock-up — not a real screenshot. Put <b>copilot-dashboard.png</b> or <b>copilot-demo.mp4</b> next to index.html and this will show the real thing.</div></div>'
    );
  }
  function typeAgent() {
    const el = document.getElementById('mockAgent');
    if (!el) return;
    const txt =
      '<span class="y">▸</span> latency spike detected on checkout-service\n<span class="y">▸</span> correlating metrics + traces...\n<span class="g">▸ likely root cause:</span> slow downstream database call\n<span class="g">▸ suggested next step:</span> inspect the slowest span';
    if (reduceMotion) {
      el.innerHTML = txt;
      return;
    }
    let i = 0,
      out = '',
      inTag = false;
    (function step() {
      if (!document.getElementById('mockAgent')) return;
      const ch = txt[i++];
      if (ch === undefined) return;
      out += ch;
      if (ch === '<') inTag = true;
      if (ch === '>') inTag = false;
      el.innerHTML = out;
      setTimeout(step, inTag ? 0 : 18);
    })();
  }
  window.__loadCaseMedia = function () {
    const host = document.getElementById('caseMedia');
    if (!host) return;
    const show = (html) => {
      host.innerHTML = html;
    };
    const tryVideo = () =>
      fetch('copilot-demo.mp4', { method: 'HEAD' }).then((r) => {
        if (!r.ok || !/video/.test(r.headers.get('content-type') || '')) throw 0;
        show(
          '<div class="frame"><video src="copilot-demo.mp4" autoplay muted loop playsinline></video></div>',
        );
      });
    const tryImg = () =>
      new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => {
          show(
            '<div class="frame"><div class="frame-bar"><i style="background:#FF5A5F"></i><i style="background:#FFD23F"></i><i style="background:#8FE24B"></i>&nbsp; incident-copilot</div><img src="copilot-dashboard.png" alt="AI Incident Copilot dashboard"></div>',
          );
          res();
        };
        im.onerror = rej;
        im.src = 'copilot-dashboard.png';
      });
    tryVideo()
      .catch(() => tryImg())
      .catch(() => {
        show(mockDashboard());
        setTimeout(typeAgent, 700);
      });
  };

  /* =====================================================================
     v12: DEV METRICS "mission control" backdrop + card-dealing shuffle
     ===================================================================== */
  (function () {
    const sec = document.getElementById('metrics');
    if (!sec) return;
    const layer = document.createElement('div');
    layer.className = 'mx-layer';
    layer.innerHTML =
      '<div class="mx-blob b1"></div><div class="mx-blob b2"></div><div class="mx-blob b3"></div><canvas id="mxCanvas"></canvas><div class="mx-floor"></div><div class="mx-scan"></div>';
    sec.insertBefore(layer, sec.firstChild);

    /* heartbeat strip */
    const grid = document.getElementById('metricsGrid');
    function ekgPath(w) {
      let d = 'M0,22',
        x = 0;
      while (x < w) {
        d += ` L${x + 50},22 L${x + 58},22 L${x + 66},4 L${x + 76},40 L${x + 84},22 L${x + 104},22 L${x + 112},16 L${x + 122},22`;
        x += 160;
      }
      return d + ` L${w},22`;
    }
    const ekg = document.createElement('div');
    ekg.className = 'ekg';
    const svg = '<svg viewBox="0 0 640 44" preserveAspectRatio="none"><path d="' + ekgPath(640) + '"/></svg>';
    ekg.innerHTML =
      '<span class="ekg-lbl">♥ build health</span><div class="ekg-view"><div class="ekg-track">' +
      svg +
      svg +
      '</div></div><span class="ekg-val">steady · 0 incidents at 2am</span>';
    grid.parentNode.insertBefore(ekg, grid);

    /* digit rain that wakes up near the cursor */
    const cv = document.getElementById('mxCanvas'),
      cx = cv.getContext('2d');
    const GL = '0123456789%+-×↑↓';
    const DPR = Math.min(window.devicePixelRatio || 1, 1.25); // decorative matrix rain: no need for retina sharpness
    let W = 0,
      H = 0,
      cols = [],
      visible = false,
      mx = -999,
      my = -999,
      raf = 0;
    const CW = 22;
    function size() {
      const r = sec.getBoundingClientRect();
      W = r.width;
      H = sec.offsetHeight;
      cv.width = W * DPR;
      cv.height = H * DPR;
      cx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const n = Math.ceil(W / CW);
      cols = Array.from(
        { length: n },
        (_, i) =>
          cols[i] || { y: Math.random() * H, v: 40 + Math.random() * 90, len: 8 + Math.random() * 16 },
      );
      cols.length = n;
    }
    size();
    window.addEventListener('resize', size);
    setTimeout(size, 1500);
    sec.addEventListener('mousemove', (e) => {
      const r = sec.getBoundingClientRect();
      mx = e.clientX - r.left;
      my = e.clientY - r.top;
    });
    sec.addEventListener('mouseleave', () => {
      mx = -999;
      my = -999;
    });
    let last = performance.now();
    function frame(now) {
      if (!visible || rootEl.classList.contains('lite')) {
        raf = 0;
        return;
      }
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      cx.globalCompositeOperation = 'destination-out';
      cx.fillStyle = 'rgba(0,0,0,.16)';
      cx.fillRect(0, 0, W, H);
      cx.globalCompositeOperation = 'source-over';
      cx.font = '700 14px "IBM Plex Mono", monospace';
      cx.textAlign = 'center';
      cols.forEach((c, i) => {
        const x = i * CW + CW / 2;
        const near = Math.max(0, 1 - Math.hypot(x - mx, c.y - my) / 220);
        c.y += c.v * (1 + near * 3) * dt;
        if (c.y > H + c.len * CW) {
          c.y = -Math.random() * 200;
          c.v = 40 + Math.random() * 90;
        }
        const ch = GL[(Math.random() * GL.length) | 0];
        cx.fillStyle = near > 0.2 ? 'rgba(255,210,63,' + (0.5 + near * 0.5) + ')' : 'rgba(143,226,75,.38)';
        cx.fillText(ch, x, c.y);
        cx.fillStyle = 'rgba(180,255,120,' + (near > 0.2 ? 0.95 : 0.6) + ')';
        cx.fillRect(x - 1, c.y + 4, 2, 2);
      });
      raf = requestAnimationFrame(frame);
    }
    if (reduceMotion) {
      cv.style.display = 'none';
    } else
      new IntersectionObserver(
        (en) => {
          visible = en[0].isIntersecting;
          if (visible && !raf) {
            last = performance.now();
            raf = requestAnimationFrame(frame);
          }
        },
        { threshold: 0 },
      ).observe(sec);
  })();

  /* ---------- tech-stack shuffle: collect into a deck, riffle, re-deal in new order ---------- */
  (function () {
    const btn = document.getElementById('shuffleBtn'),
      grid = document.getElementById('stackGrid');
    if (!btn || !grid) return;
    let dealing = false,
      count = 0;
    const R = (a, b) => a + Math.random() * (b - a);
    btn.addEventListener('click', () => {
      if (dealing) return;
      dealing = true;
      count++;
      btn.disabled = true;
      const panels = Array.from(grid.querySelectorAll(':scope > .stack-panel'));
      if (reduceMotion) {
        panels.sort(() => Math.random() - 0.5).forEach((p) => grid.appendChild(p));
        dealing = false;
        btn.disabled = false;
        return;
      }
      grid.classList.add('dealing');
      const label = btn.firstChild;
      btn.dataset.o = btn.dataset.o || btn.innerHTML;
      btn.innerHTML = '🃏 dealing…';
      const gr = grid.getBoundingClientRect();
      const vcx = gr.left + gr.width / 2,
        vcy = Math.min(gr.top + gr.height / 2, window.innerHeight * 0.55);
      if (window.__sfx) window.__sfx.whoosh(0.06);
      const toDeck = (p) => {
        const r = p.getBoundingClientRect();
        return { x: vcx - (r.left + r.width / 2), y: vcy - (r.top + r.height / 2) };
      };
      const tl = gsap.timeline({
        onComplete: () => {
          gsap.set(panels, { clearProps: 'transform,x,y,rotation,scale,zIndex' });
          grid.classList.remove('dealing');
          panels.forEach((p) => p.style.setProperty('--r', (Math.random() * 6 - 3).toFixed(2) + 'deg'));
          document
            .querySelectorAll('.stack-panel .node')
            .forEach((n) =>
              gsap.to(n, {
                rotate: gsap.utils.random(-8, 8),
                y: gsap.utils.random(-3, 3),
                duration: 0.45,
                ease: 'back.out(2)',
              }),
            );
          btn.innerHTML = btn.dataset.o + '<span class="shuffle-count">×' + count + '</span>';
          btn.disabled = false;
          dealing = false;
          if (count === 7) {
            showToast('🃏 full house — you really like shuffling.', 3000);
            burstConfetti(window.innerWidth / 2, window.innerHeight / 2);
          }
        },
      });
      /* 1. every panel flies to the middle and stacks */
      panels.forEach((p, i) => {
        const d = toDeck(p);
        tl.to(
          p,
          {
            x: d.x + R(-8, 8),
            y: d.y + R(-8, 8),
            rotation: R(-14, 14),
            scale: 0.5,
            zIndex: 10 + i,
            duration: 0.5,
            ease: 'power3.inOut',
          },
          i * 0.05,
        );
      });
      /* 2. riffle: split the deck left/right and interleave */
      tl.addLabel('riffle', '>');
      panels.forEach((p, i) => {
        tl.to(
          p,
          {
            x: '+=' + (i % 2 ? 160 : -160),
            rotation: (i % 2 ? 1 : -1) * R(10, 22),
            duration: 0.16,
            ease: 'power2.out',
            yoyo: true,
            repeat: 3,
          },
          'riffle+=' + i * 0.02,
        );
      });
      /* 3. re-order the DOM while hidden in the deck, then deal back out */
      tl.add(() => {
        const order = panels.slice().sort(() => Math.random() - 0.5);
        order.forEach((p) => grid.appendChild(p));
        gsap.set(panels, { x: 0, y: 0, rotation: 0, scale: 1 });
        panels.forEach((p, i) => {
          const d = toDeck(p);
          gsap.set(p, { x: d.x, y: d.y, rotation: R(-12, 12), scale: 0.5, zIndex: 10 + i });
        });
        order.forEach((p, i) => {
          gsap.to(p, {
            x: 0,
            y: 0,
            rotation: 0,
            scale: 1,
            duration: 0.75,
            delay: i * 0.11,
            ease: 'back.out(1.5)',
            onStart: () => {
              if (window.__sfx) window.__sfx.tick();
            },
          });
        });
        if (typeof burstConfetti === 'function') setTimeout(() => burstConfetti(vcx, vcy), 400);
      }, '>+.05');
      tl.to({}, { duration: 0.75 + panels.length * 0.11 + 0.1 });
    });
  })();

  /* =====================================================================
     v13: Bit companion, journey Bit, build log, secret room
     ===================================================================== */
  function miniBit() {
    return (
      '<svg class="mbit" viewBox="0 0 100 112" aria-hidden="true">' +
      '<g class="mb-ant"><line x1="50" y1="30" x2="50" y2="15" stroke="#0B0B0F" stroke-width="5" stroke-linecap="round"/><circle cx="50" cy="10" r="7" fill="#FF5A5F" stroke="#0B0B0F" stroke-width="4"/></g>' +
      '<rect x="11" y="52" width="10" height="24" rx="4" fill="#B892FF" stroke="#0B0B0F" stroke-width="3.5"/><rect x="79" y="52" width="10" height="24" rx="4" fill="#B892FF" stroke="#0B0B0F" stroke-width="3.5"/>' +
      '<rect x="30" y="92" width="14" height="14" rx="4" fill="#0B0B0F"/><rect x="56" y="92" width="14" height="14" rx="4" fill="#0B0B0F"/>' +
      '<rect x="18" y="30" width="64" height="64" rx="18" fill="#FFD23F" stroke="#0B0B0F" stroke-width="5"/>' +
      '<g class="mb-eyes"><circle class="mb-eye" cx="37" cy="57" r="11" fill="#fff" stroke="#0B0B0F" stroke-width="3.5"/><circle class="mb-eye" cx="63" cy="57" r="11" fill="#fff" stroke="#0B0B0F" stroke-width="3.5"/>' +
      '<g class="mb-pup"><circle cx="37" cy="57" r="4.6" fill="#0B0B0F"/></g><g class="mb-pup"><circle cx="63" cy="57" r="4.6" fill="#0B0B0F"/></g></g>' +
      '<g class="mb-closed" fill="none" stroke="#0B0B0F" stroke-width="4" stroke-linecap="round"><path d="M27 58 Q37 65 47 58"/><path d="M53 58 Q63 65 73 58"/></g>' +
      '<path class="mb-smile" d="M40 77 Q50 86 60 77" fill="none" stroke="#0B0B0F" stroke-width="4.5" stroke-linecap="round"/>' +
      '<ellipse class="mb-o" cx="50" cy="80" rx="6" ry="7.5" fill="#0B0B0F"/>' +
      '<path class="mb-wavy" d="M37 80 q4.5 -6 9 0 t9 0 t9 0" fill="none" stroke="#0B0B0F" stroke-width="4" stroke-linecap="round"/>' +
      '<circle cx="28" cy="76" r="4.5" fill="#FF5A5F" opacity=".6"/><circle cx="72" cy="76" r="4.5" fill="#FF5A5F" opacity=".6"/>' +
      '<g class="mb-acc"></g></svg>'
    );
  }
  const ACC = {
    cap: '<polygon points="50,12 86,26 50,40 14,26" fill="#0B0B0F"/><rect x="34" y="34" width="32" height="11" fill="#0B0B0F"/><line x1="82" y1="27" x2="82" y2="46" stroke="#FFD23F" stroke-width="3"/><circle cx="82" cy="48" r="3.5" fill="#FFD23F"/>',
    badge:
      '<line x1="40" y1="94" x2="46" y2="100" stroke="#3B4CFF" stroke-width="3"/><line x1="60" y1="94" x2="54" y2="100" stroke="#3B4CFF" stroke-width="3"/><rect x="38" y="98" width="24" height="15" rx="3" fill="#fff" stroke="#0B0B0F" stroke-width="2.5"/><rect x="42" y="102" width="9" height="3" fill="#FF5A5F"/><rect x="42" y="107" width="16" height="2.5" fill="#0B0B0F"/>',
    laptop:
      '<rect x="24" y="96" width="52" height="16" rx="3" fill="#2b2b36" stroke="#0B0B0F" stroke-width="3"/><text x="50" y="108" text-anchor="middle" font-family="IBM Plex Mono" font-size="10" font-weight="700" fill="#8FE24B">&lt;/&gt;</text>',
    cert: '<rect x="26" y="96" width="48" height="16" rx="2" fill="#fff" stroke="#0B0B0F" stroke-width="3"/><circle cx="64" cy="106" r="6" fill="#FF5A5F" stroke="#0B0B0F" stroke-width="2"/><rect x="31" y="101" width="22" height="2.5" fill="#0B0B0F"/><rect x="31" y="106" width="16" height="2.5" fill="#0B0B0F"/>',
    party:
      '<polygon points="50,-4 68,32 32,32" fill="#B892FF" stroke="#0B0B0F" stroke-width="4" stroke-linejoin="round"/><circle cx="50" cy="-5" r="5" fill="#FFD23F" stroke="#0B0B0F" stroke-width="3"/>',
  };

  /* shared eye-tracking for any mini Bit svg */
  function lookAt(svg, cx, cy, maxd) {
    const eyes = svg.querySelectorAll('.mb-eye'),
      pups = svg.querySelectorAll('.mb-pup');
    eyes.forEach((eye, i) => {
      const r = eye.getBoundingClientRect();
      const ex = r.left + r.width / 2,
        ey = r.top + r.height / 2;
      const dx = cx - ex,
        dy = cy - ey,
        dist = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, dist / 160) * (maxd || 3.6);
      pups[i].setAttribute(
        'transform',
        'translate(' + ((dx / dist) * k).toFixed(2) + ' ' + ((dy / dist) * k).toFixed(2) + ')',
      );
    });
  }

  /* ---------- achievements + visits (local to this browser) ---------- */
  const ACH = {
    explorer: ['🧭', 'Explorer', 'visited every section'],
    terminal: ['⌨️', 'Hacker', 'opened the terminal'],
    game: ['🎮', 'Gamer', 'played Bug Catcher'],
    chat: ['💬', 'Chatterbox', 'talked to Bit'],
    konami: ['🎹', 'Old-school', 'entered the Konami code'],
    sound: ['🔊', 'Audiophile', 'turned sound on'],
    end: ['🏁', 'Finisher', 'scrolled to the very end'],
    sudo: ['🔑', 'Root access', 'ran sudo hire rohal'],
    npm: ['📦', 'Auditor', 'ran npm ls on my skills'],
    pager: ['🚨', 'On-call hero', 'fixed the Friday deploy'],
    stylist: ['🎨', 'Stylist', 'restyled the whole site'],
  };
  let achSet = [];
  try {
    achSet = JSON.parse(lsGet('rk-ach') || '[]');
  } catch (e) {
    achSet = [];
  }
  const visitNo = (parseInt(lsGet('rk-visits') || '0', 10) || 0) + 1;
  lsSet('rk-visits', String(visitNo));
  const secretBtn = document.createElement('button');
  secretBtn.className = 'secret-btn';
  secretBtn.type = 'button';
  (function () {
    const foot = document.querySelector('footer .foot-row span:last-child');
    if (foot) foot.appendChild(secretBtn);
  })();
  const secretOv = document.getElementById('secretOv');
  ovs.push(secretOv);
  function refreshSecretBtn() {
    const un = achSet.indexOf('end') > -1;
    secretBtn.textContent = un ? '🔓 secret room' : '🔒 secret room';
    secretBtn.classList.toggle('unlocked', un);
  }
  refreshSecretBtn();
  window.__ach = function (k) {
    if (!ACH[k] || achSet.indexOf(k) > -1) return;
    achSet.push(k);
    lsSet('rk-ach', JSON.stringify(achSet));
    refreshSecretBtn();
    showToast('🏆 achievement: ' + ACH[k][1] + ' — ' + ACH[k][2], 3200);
    if (window.__sfx) window.__sfx.section();
    if (k === 'end') {
      setTimeout(() => showToast('🔓 secret room unlocked — look in the footer', 3600), 3400);
      burstConfetti(window.innerWidth / 2, window.innerHeight * 0.4);
    }
  };
  function openSecret() {
    if (achSet.indexOf('end') < 0) {
      const max = Math.max(1, document.body.scrollHeight - window.innerHeight);
      showToast(
        '🔒 locked — scroll to the very end (' +
          Math.min(99, Math.round((currentScroll / max) * 100)) +
          '% there)',
        2800,
      );
      return;
    }
    $('srGrid').innerHTML = Object.keys(ACH)
      .map(
        (k) =>
          '<div class="sr-tile' +
          (achSet.indexOf(k) > -1 ? ' got' : '') +
          '"><b>' +
          ACH[k][0] +
          '</b>' +
          ACH[k][1] +
          '<br><span style="font-weight:500;opacity:.8">' +
          ACH[k][2] +
          '</span></div>',
      )
      .join('');
    $('srFoot').textContent =
      'visit #' +
      visitNo +
      ' · ' +
      achSet.length +
      '/' +
      Object.keys(ACH).length +
      ' achievements · stored only in your browser, nothing is tracked';
    $('srReward').innerHTML =
      achSet.length >= 5
        ? '🎁 You are a platinum explorer. Mention code <b>RK-ROOM</b> in your message and I will know you found this.<br><a href="mailto:kabirrohal7@gmail.com?subject=' +
          encodeURIComponent('[RK-ROOM] I found your secret room') +
          '">✉ email Rohal with the code</a>'
        : '🎁 Unlock 5 achievements for a small surprise. Hint: try the terminal, the game, the chat, and the Konami code.';
    openOv(secretOv);
  }
  secretBtn.addEventListener('click', openSecret);
  $('srX').addEventListener('click', () => secretOv.classList.remove('open'));
  cmds.push(['🔓', 'Secret room', 'easter egg achievements', openSecret]);

  /* ---------- Bit companion (floating after the hero) ---------- */
  const dock = document.createElement('div');
  dock.className = 'bit-dock away';
  dock.innerHTML =
    '<div class="bit-bubble" id="bdBubble"></div><div class="bit-zzz">z<i>z</i><b>Z</b></div><button class="bit-btn" type="button" aria-label="Chat with Bit">' +
    miniBit() +
    '</button>';
  document.body.appendChild(dock);
  const dockSvg = dock.querySelector('.mbit'),
    dockBtn = dock.querySelector('.bit-btn'),
    bdBubble = dock.querySelector('#bdBubble');
  let bdT = null,
    lastAct = performance.now(),
    asleep = false,
    stateT = null;
  function dockSay(msg, ms) {
    if (dock.classList.contains('away')) {
      if (typeof mascotSay === 'function') mascotSay(msg, ms || 2800);
      return;
    }
    bdBubble.textContent = msg;
    bdBubble.classList.add('show');
    clearTimeout(bdT);
    bdT = setTimeout(() => bdBubble.classList.remove('show'), ms || 3000);
  }
  function dockState(cls, ms) {
    dockSvg.classList.add(cls);
    clearTimeout(stateT);
    stateT = setTimeout(() => dockSvg.classList.remove(cls), ms);
  }
  window.__bitReact = function (kind) {
    if (kind === 'terminal') {
      dockState('wow', 1800);
      dockSay('whoa — hacker mode? 😮', 3000);
    } else if (kind === 'game') {
      dockState('wow', 1200);
      dockSay('bug hunt! 🐛 go go go', 2600);
    } else if (kind === 'secret') {
      dockState('wow', 1200);
      dockSay('you found the secret room 🔓', 2800);
    }
  };
  dockBtn.addEventListener('click', () => {
    if (chatFab) chatFab.click();
  });
  function wake() {
    lastAct = performance.now();
    if (asleep) {
      asleep = false;
      dockSvg.classList.remove('sleep');
      dock.classList.remove('asleep');
      dockState('wow', 900);
      dockSay('!! I’m up, I’m up ☕', 2400);
    }
  }
  ['mousemove', 'keydown', 'touchstart', 'wheel', 'pointerdown'].forEach((ev) =>
    window.addEventListener(ev, wake, { passive: true }),
  );
  let lookRaf = 0,
    lx = 0,
    ly = 0;
  window.addEventListener(
    'mousemove',
    (e) => {
      lx = e.clientX;
      ly = e.clientY;
      if (lookRaf) return;
      lookRaf = requestAnimationFrame(() => {
        lookRaf = 0;
        if (!dock.classList.contains('away') && !asleep) lookAt(dockSvg, lx, ly, 3.6);
      });
    },
    { passive: true },
  );
  const dockLean = gsap.quickTo(dockBtn, 'rotation', { duration: 0.5, ease: 'power3' });
  const secQuips = {
    replay: 'Replay time — this one is a story.',
    build: 'This is how he builds. Worth a read.',
    about: 'Meet the human behind the commits.',
    metrics: 'Numbers don’t lie 📊 hover a card!',
    work: 'Click a card for the full case study.',
    github: 'Yes, that heatmap is live.',
    stack: 'Try the shuffle button 🃏',
    journey: 'Follow me down the line →',
    log: 'Fresh build notes. Tap one!',
    contact: 'Say hi! He replies within a day.',
  };
  const quipped = {};
  let curSec = null,
    lastScroll = currentScroll,
    dizzyAt = 0,
    hotCount = 0;
  const secEls = Array.from(document.querySelectorAll('section[id]'));
  const visited = {};
  /* journey rider */
  const jh = document.getElementById('journeyHead'),
    jItems = Array.from(document.querySelectorAll('.journey-item'));
  let jbSvg = null,
    jbPop = null,
    jbIdx = -2;
  if (jh) {
    jh.innerHTML = '<div class="jb-bit">' + miniBit() + '<span class="jb-pop"></span></div>';
    jbSvg = jh.querySelector('.mbit');
    jbPop = jh.querySelector('.jb-pop');
    jbSvg.querySelectorAll('.mb-pup').forEach((p) => p.setAttribute('transform', 'translate(2.6 1.6)'));
  }
  const jAcc = ['cap', 'badge', 'cap', 'laptop', 'cert', 'party'],
    jPop = ['🎓', '🪪', '🎓', '💻', '📜', '🚀'];
  function updateJourneyBit() {
    if (!jbSvg) return;
    let idx = -1;
    jItems.forEach((it, i) => {
      if (it.classList.contains('lit')) idx = i;
    });
    if (idx === jbIdx) return;
    jbIdx = idx;
    const acc = jbSvg.querySelector('.mb-acc');
    acc.innerHTML = idx > -1 ? ACC[jAcc[idx] || 'party'] : '';
    if (idx > -1 && !reduceMotion) {
      const box = jh.querySelector('.jb-bit');
      gsap.fromTo(box, { y: 0 }, { y: -9, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' });
      jbPop.textContent = jPop[idx] || '✨';
      gsap.fromTo(
        jbPop,
        { opacity: 1, y: 0, scale: 0.6 },
        { opacity: 0, y: -26, scale: 1.3, duration: 1.1, ease: 'power2.out' },
      );
      if (window.__sfx) window.__sfx.tick();
    }
  }
  setInterval(() => {
    const now = performance.now();
    /* away while the big hero Bit is on screen */
    if (document.hidden) return;
    const heroVisible = layout.heroTop + layout.heroH - currentScroll > window.innerHeight * 0.55;
    dock.classList.toggle('away', !!heroVisible);
    /* scroll reactions */
    const dv = currentScroll - lastScroll;
    lastScroll = currentScroll;
    const sp = Math.abs(dv);
    dockLean(Math.max(-9, Math.min(9, dv * 0.25)));
    if (!asleep && !heroVisible && Math.abs(dv) > 2) {
      dockSvg
        .querySelectorAll('.mb-pup')
        .forEach((p) => p.setAttribute('transform', 'translate(0 ' + (dv > 0 ? 3.4 : -3.4) + ')'));
    }
    hotCount = sp > 48 ? hotCount + 1 : 0;
    if (hotCount >= 2 && now - dizzyAt > 9000 && !asleep) {
      dizzyAt = now;
      dockState('dizzy', 1500);
      dockSay('weeeee 🌀', 1800);
    }
    /* section change quips + explorer + end of page */
    let cs = null;
    secEls.forEach((s, i) => {
      if (layout.tops[i] - currentScroll < window.innerHeight * 0.45) cs = s.id;
    });
    if (cs) {
      visited[cs] = 1;
      if (cs !== curSec) {
        curSec = cs;
        if (secQuips[cs] && !quipped[cs] && !asleep) {
          quipped[cs] = 1;
          dockSay(secQuips[cs], 3200);
        }
      }
    }
    if (secEls.length && secEls.every((s) => visited[s.id])) window.__ach('explorer');
    const max = layout.docMax;
    if (max > 400 && currentScroll / max > 0.965) window.__ach('end');
    /* idle -> sleep */
    if (!asleep && now - lastAct > 25000) {
      asleep = true;
      dockSvg.classList.add('sleep');
      dock.classList.add('asleep');
      dockSvg.classList.remove('wow', 'dizzy');
      dockSay('…zzz', 2200);
    }
    updateJourneyBit();
  }, 100);

  /* ---------- build log: expandable notes ---------- */
  document.querySelectorAll('.log-card .log-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.log-card');
      const open = !card.classList.contains('open');
      card.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', String(open));
      btn.querySelector('span').textContent = open ? 'close the note' : 'read the note';
      if (window.__sfx) window.__sfx.pop();
      setTimeout(() => {
        ScrollTrigger.refresh();
        if (typeof setBodyHeight === 'function') setBodyHeight();
      }, 520);
    });
  });

  /* =====================================================================
     PERFORMANCE LAYER
     1. pause every CSS animation that is not on screen
     2. adaptive "lite" mode: if the device cannot keep up while scrolling,
        drop the expensive extras (skew, blurs, canvas rain, glow loops)
     ===================================================================== */
  if ('IntersectionObserver' in window) {
    const offIO = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.target.classList.toggle('is-off', !e.isIntersecting)),
      { rootMargin: '120px 0px' },
    );
    document.querySelectorAll('section, footer, .wave-divider, .velocity-banner').forEach((el) => offIO.observe(el));
  }
  (function adaptiveQuality() {
    let stored = null;
    try {
      stored = sessionStorage.getItem('rk-lite');
    } catch (e) {
      /* ignore */
    }
    const weak = (navigator.hardwareConcurrency || 8) <= 2 || (navigator.deviceMemory || 8) <= 4;
    const setLite = (on, remember) => {
      rootEl.classList.toggle('lite', on);
      if (remember) {
        try {
          sessionStorage.setItem('rk-lite', on ? '1' : '0');
        } catch (e) {
          /* ignore */
        }
      }
    };
    if (stored === '1' || (stored === null && weak)) setLite(true, false);
    if (reduceMotion) return;
    const boot = performance.now();
    let last = performance.now(),
      lastY = currentScroll,
      sum = 0,
      n = 0,
      strikes = 0;
    (function watch(now) {
      const dt = now - last;
      last = now;
      const moving = Math.abs(currentScroll - lastY) > 0.5;
      lastY = currentScroll;
      /* judge only real scrolling frames, and never during the intro */
      if (moving && dt < 250 && now - boot > 9000 && !rootEl.classList.contains('lite')) {
        sum += dt;
        if (++n === 90) {
          strikes = sum / n > 34 ? strikes + 1 : 0;
          sum = n = 0;
          if (strikes >= 2) {
            setLite(true, true);
            showToast('⚡ lite mode on — smoother scrolling on this device (change it in Ctrl+K)', 4200);
          }
        }
      }
      requestAnimationFrame(watch);
    })(performance.now());
    cmds.push([
      '⚡',
      'Toggle lite mode (faster scrolling)',
      'performance lite fast smooth lag',
      () => {
        const on = !rootEl.classList.contains('lite');
        setLite(on, true);
        showToast(on ? '⚡ lite mode on' : 'lite mode off — full effects', 2200);
      },
    ]);
  })();

  /* ---------- hand-off to js/features.js (loaded after this file) ---------- */
  window.__rk = {
    TC, tp, esc, A, ovs, cmds, openOv, closeOvs, burstConfetti, goTo, showToast, reduceMotion,
    get termOpen() { return termOv.classList.contains('open'); },
    closeTerm: () => termOv.classList.remove('open'),
  };
})();
