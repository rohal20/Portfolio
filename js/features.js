/* ==========================================================================
   rohal.dev — v16 features (loaded after main.js)

     1. npm ls          skills printed as a dependency tree
     2. terminal        sudo hire rohal + hidden commands
     3. Friday deploy   glitch -> pager -> stack trace -> fix it with git
     4. theme drawer    live sliders, presets, "copy my theme"
     5. live cursors    other visitors as labelled cursors (optional backend)

   main.js hands over its helpers through window.__rk.
   ========================================================================== */
(function () {
  'use strict';
  const rk = window.__rk;
  if (!rk) return;
  const { TC, tp, esc, A, ovs, cmds, openOv, closeOvs, burstConfetti, goTo, showToast, reduceMotion } = rk;
  const $ = (id) => document.getElementById(id);
  const root = document.documentElement;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const ach = (k) => {
    if (window.__ach) window.__ach(k);
  };
  const store = {
    get(k) {
      try {
        return localStorage.getItem(k);
      } catch (e) {
        return null;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, v);
      } catch (e) {
        /* private mode: ignore */
      }
    },
    del(k) {
      try {
        localStorage.removeItem(k);
      } catch (e) {
        /* ignore */
      }
    },
  };

  /* ======================================================================
     CONFIG — live cursors need a tiny relay server. Leave empty to use the
     built-in fallback (works across tabs of the same browser only).
     Setup: see party/README.md  ->  e.g. 'rohal-cursors.yourname.partykit.dev'
     ====================================================================== */
  const REALTIME_HOST = '';
  const REALTIME_ROOM = 'rohal-portfolio';

  /* ======================================================================
     1. npm ls — skills as a dependency tree
     ====================================================================== */
  const SKILLS = [
    [
      'lang',
      [
        ['typescript', 'expert'],
        ['python', 'proficient'],
        ['java', 'proficient'],
        ['sql', 'proficient'],
        ['c-cpp-csharp', 'proficient'],
        ['bash', 'learning'],
      ],
    ],
    [
      'web',
      [
        ['react', 'expert'],
        ['node.js', 'expert'],
        ['rest-apis', 'expert'],
        ['django', 'proficient'],
        ['react-native', 'proficient'],
      ],
    ],
    [
      'ai-llm',
      [
        ['claude-api', 'proficient'],
        ['llm-agents', 'proficient'],
        ['prompt-engineering', 'proficient'],
        ['rag', 'learning'],
      ],
    ],
    [
      'obs',
      [
        ['opentelemetry', 'proficient'],
        ['prometheus', 'proficient'],
        ['grafana', 'proficient'],
        ['jaeger', 'proficient'],
        ['datadog', 'learning'],
      ],
    ],
    [
      'ops',
      [
        ['docker', 'proficient'],
        ['github-actions', 'proficient'],
        ['kubernetes', 'learning'],
        ['openshift', 'learning'],
      ],
    ],
    [
      'data',
      [
        ['postgresql', 'proficient'],
        ['sql-server', 'proficient'],
        ['mysql', 'proficient'],
        ['mongodb', 'proficient'],
        ['firebase', 'learning'],
      ],
    ],
  ];
  const SKILL_COUNT = SKILLS.reduce((n, g) => n + g[1].length, 0);

  function npmTree() {
    const out = ['<span class="y">rohal-kabir@2026</span> <span class="d">/portfolio</span>'];
    SKILLS.forEach(([group, items], gi) => {
      const lastGroup = gi === SKILLS.length - 1;
      out.push((lastGroup ? '└─┬ ' : '├─┬ ') + '<span class="p">' + group + '</span>');
      items.forEach(([name, level], i) => {
        const last = i === items.length - 1;
        out.push(
          (lastGroup ? '  ' : '│ ') +
            (last ? '└── ' : '├── ') +
            name +
            '<span class="d">@</span><span class="lv-' +
            level +
            '">' +
            level +
            '</span>',
        );
      });
    });
    return out;
  }
  const npmSummary = () => [
    '',
    'added <span class="g">' + SKILL_COUNT + '</span> packages in 0.4s',
    'found <span class="g">0</span> vulnerabilities',
    '',
    '<span class="d">1 package is looking for funding</span>',
    '  run <span class="npm-fund">npm fund</span> <span class="d">for details</span>',
    '',
    '<span class="d">legend:</span> <span class="lv-expert">expert</span> <span class="d">= daily driver ·</span> <span class="lv-proficient">proficient</span> <span class="d">= ships it ·</span> <span class="lv-learning">learning</span> <span class="d">= in progress</span>',
  ];

  const npmOv = $('npmOv'),
    npmOut = $('npmOut'),
    npmCmd = $('npmCmd');
  ovs.push(npmOv);
  let npmRun = 0;
  let npmSkip = false;
  async function runNpm() {
    const id = ++npmRun;
    npmSkip = false;
    openOv(npmOv);
    ach('npm');
    npmOut.innerHTML = '';
    npmCmd.textContent = '';
    const text = 'npm ls --depth=1';
    for (const ch of text) {
      if (id !== npmRun) return;
      npmCmd.textContent += ch;
      if (!npmSkip && !reduceMotion) await sleep(34);
    }
    if (!npmSkip && !reduceMotion) await sleep(220);
    const lines = npmTree().concat(npmSummary());
    for (const line of lines) {
      if (id !== npmRun) return;
      npmOut.insertAdjacentHTML('beforeend', line + '\n');
      npmOut.scrollTop = npmOut.scrollHeight;
      if (window.__sfx && !npmSkip) window.__sfx.tick();
      if (!npmSkip && !reduceMotion) await sleep(line.length > 3 ? 42 : 90);
    }
  }
  npmOv.addEventListener('click', (e) => {
    const fund = e.target.closest('.npm-fund');
    if (fund) {
      npmOv.classList.remove('open');
      A.hire();
      return;
    }
    npmSkip = true;
  });
  $('npmBtn').addEventListener('click', runNpm);
  cmds.push(['📦', 'npm ls — my skills as a dependency tree', 'dependencies skills tree', runNpm]);

  /* ======================================================================
     2. Terminal: sudo hire rohal + hidden commands
     ====================================================================== */
  const termLines = async (lines, gap) => {
    for (const l of lines) {
      tp(l);
      await sleep(reduceMotion ? 0 : gap || 260);
    }
  };

  async function sudoHire() {
    ach('sudo');
    await termLines(
      [
        '<span class="d">[sudo] password for visitor:</span> ********',
        '<span class="g">✔</span> authenticated as <span class="y">root</span>',
        '<span class="g">✔</span> résumé verified <span class="d">(Rohal_Kabir_Resume.pdf)</span>',
        '<span class="g">✔</span> incident diagnosis time: <span class="y">-90%</span> <span class="d">(measured, not vibes)</span>',
        '<span class="g">✔</span> coffee supply: <span class="c">critical</span> <span class="d">— send more</span>',
        '<span class="g">✔</span> offer_letter.pdf <span class="d">generated</span>',
        '🎉 <span class="g">permission granted.</span> opening the contact form…',
      ],
      300,
    );
    [0, 220, 460].forEach((d, i) =>
      setTimeout(
        () => burstConfetti(window.innerWidth * (0.3 + i * 0.2), window.innerHeight * (0.35 + (i % 2) * 0.15)),
        d,
      ),
    );
    await sleep(900);
    rk.closeTerm();
    goTo('contact');
    setTimeout(() => {
      const msg = $('cf-msg');
      if (msg && !msg.value.trim()) msg.value = 'Hi Rohal — I ran `sudo hire rohal` on your site. Let’s talk.';
      const name = $('cf-name');
      if (name) name.focus({ preventScroll: true });
    }, 900);
  }

  const hidden = {
    'sudo rm -rf /': () =>
      tp('<span class="c">nice try.</span> deleting node_modules instead… <span class="g">freed 4.2 GB</span> 🧹'),
    'rm -rf /': () => tp('rm: it is dangerous to operate recursively on <span class="y">/</span>  <span class="d">(you’re learning!)</span>'),
    'rm -rf node_modules': () => tp('<span class="g">done.</span> <span class="d">npm install (4 minutes later)…</span> 😭'),
    vim: () => tp('you are now trapped in vim. <span class="d">(press :q! to escape — good luck)</span>'),
    ':q!': () => tp('<span class="g">escaped.</span> most people never find this.'),
    emacs: () => tp('emacs: loading 14 years of config… <span class="d">(try “vim”)</span>'),
    sl: () => tp('🚂💨 choo choo — you meant <span class="y">ls</span>, didn’t you?'),
    fortune: () =>
      tp(
        [
          'a bug fixed on Friday creates two on Monday.',
          'the best code is the code you deleted.',
          'it works on my machine. ship the machine.',
          'there are only two hard things: cache invalidation, naming, and off-by-one errors.',
        ][Math.floor(Math.random() * 4)],
      ),
    cowsay: () =>
      tp(
        ' ______________\n&lt; hire rohal 🐮 &gt;\n --------------\n        \\   ^__^\n         \\  (oo)\\_______\n            (__)\\       )\\/\\\n                ||----w |\n                ||     ||',
      ),
    'man rohal': () =>
      tp(
        '<span class="y">ROHAL(1)</span>                 Developer Manual                 <span class="y">ROHAL(1)</span>\n\n<span class="y">NAME</span>\n       rohal — full-stack developer who instruments what he builds\n<span class="y">SYNOPSIS</span>\n       rohal [--remote] [--react|--node|--django] [--observable]\n<span class="y">DESCRIPTION</span>\n       Ships features, then adds the dashboards that tell you they work.\n<span class="y">BUGS</span>\n       Overcommits to tests. Occasionally runs on chai.',
      ),
    'ssh rohal': () => tp('ssh: connect to host rohal port 22: <span class="g">Welcome. no password needed — you’re already in.</span>'),
    'curl rohal': () => tp('HTTP/1.1 <span class="g">200 OK</span>\nX-Available-For-Work: true\nX-Coffee-Level: low'),
    matrix: () => matrixRain(),
    hack: () => {
      tp('<span class="g">accessing mainframe…</span>');
      setTimeout(() => tp('bypassing firewall… <span class="g">done</span>'), 500);
      setTimeout(() => tp('downloading résumé… <span class="g">100%</span> — you have been hired. 🕶'), 1100);
    },
    '42': () => tp('the answer to life, the universe, and everything. also the number of bugs I just fixed.'),
    uname: () => tp('RohalOS 16.0 neo-brutalist x86_64 GNU/Chai'),
    'uname -a': () => tp('RohalOS 16.0 neo-brutalist #1 SMP Friday x86_64 GNU/Chai'),
    pwd: () => tp('/home/visitor/portfolio'),
    top: () => tp('<span class="y">PID  CMD            %CPU</span>\n  1  coffee.service   99\n  2  react-dev-server 41\n  3  imposter-syndrome 0.1 <span class="d">(finally idle)</span>'),
    'make coffee': () => tp('make: <span class="c">***</span> no rule to make target “coffee”. try <span class="y">npm run coffee</span>'),
    'sudo make me a sandwich': () => tp('okay. 🥪 <span class="d">(xkcd would be proud)</span>'),
    history: () => tp('<span class="d">you can press ↑ for that. we both know it.</span>'),
    'git blame': () => tp('<span class="y">f00dbab</span> (visitor) <span class="d">you broke it. probably.</span>'),
    'git push --force': () => {
      tp('<span class="c">force pushing to main?</span> bold. let’s see what happens…');
      setTimeout(() => {
        rk.closeTerm();
        startIncident();
      }, 900);
    },
    deploy: () => {
      tp('deploying to <span class="y">production</span>… <span class="d">on a Friday</span> 😬');
      setTimeout(() => {
        rk.closeTerm();
        startIncident();
      }, 900);
    },
    'deploy friday': () => hidden.deploy(),
  };

  const hiddenKeys = Object.keys(hidden);
  const baseSudo = TC.sudo,
    baseGit = TC.git,
    baseNpm = TC.npm;
  const lookup = (parts) => {
    const full = parts.join(' ').toLowerCase();
    return hidden[full];
  };
  TC.sudo = (a) => {
    const full = a.join(' ').toLowerCase().trim();
    if (/^hire(\s+(rohal|me|him))?$/.test(full)) return void sudoHire();
    const h = hidden['sudo ' + full];
    if (h) return h();
    return baseSudo(a);
  };
  TC.git = (a) => {
    const h = lookup(['git'].concat(a));
    if (h) return h();
    return baseGit(a);
  };
  TC.npm = (a) => {
    const full = a.join(' ').toLowerCase().trim();
    if (/^ls\b|^list\b|^ll\b/.test(full)) {
      npmTree().concat(npmSummary()).forEach((l) => tp(l));
      ach('npm');
      return;
    }
    if (full === 'fund') {
      tp('<span class="g">rohal-kabir@2026</span> is looking for funding: <span class="y">a great team</span>. opening the hire panel…');
      setTimeout(A.hire, 600);
      return;
    }
    if (/^(i|install|add)\s+rohal/.test(full)) {
      tp('added <span class="g">1 package</span>: rohal@latest <span class="d">— 0 vulnerabilities, 0 deprecated, 100% shipped.</span>');
      setTimeout(A.hire, 800);
      return;
    }
    return baseNpm(a);
  };
  TC.secrets = () => tp('there are <span class="y">' + hiddenKeys.length + '</span> hidden commands in here. <span class="d">hint: classic unix, classic jokes, one big red button.</span>');
  // generic lookup for commands the main terminal would reject (vim, sl, fortune, …)
  ['vim', 'emacs', 'sl', 'fortune', 'cowsay', 'matrix', 'hack', '42', 'uname', 'pwd', 'top', 'history', 'deploy', 'man', 'ssh', 'curl', 'rm', 'make', ':q!'].forEach((c) => {
    if (TC[c]) return;
    TC[c] = (a) => {
      const full = [c].concat(a).join(' ').toLowerCase();
      const h = hidden[full] || hidden[c];
      if (h) return h();
      if (c === 'man') return tp('What manual page do you want? try <span class="y">man rohal</span>');
      if (c === 'ssh') return tp('usage: ssh &lt;host&gt;  <span class="d">(try “ssh rohal”)</span>');
      if (c === 'curl') return tp('curl: try <span class="y">curl rohal</span>');
      if (c === 'rm') return tp('rm: missing operand. <span class="d">probably for the best.</span>');
      if (c === 'make') return tp('make: *** No targets specified. <span class="d">(try “make coffee”)</span>');
      tp('<span class="c">command not found:</span> ' + esc(full));
    };
  });
  const baseHelp = TC.help;
  TC.help = () => {
    baseHelp();
    tp('  <span class="d">more: npm ls · npm fund · deploy · theme &lt;name&gt; · secrets</span>');
  };

  // matrix rain: a brief full-screen canvas, cleaned up after 5s
  function matrixRain() {
    tp('<span class="g">wake up, visitor…</span>');
    if (reduceMotion) return;
    const cv = document.createElement('canvas');
    cv.style.cssText = 'position:fixed;inset:0;z-index:1800;pointer-events:none;opacity:.85';
    document.body.appendChild(cv);
    const ctx = cv.getContext('2d');
    const w = (cv.width = window.innerWidth),
      h = (cv.height = window.innerHeight);
    const cols = Math.floor(w / 16);
    const drops = Array.from({ length: cols }, () => Math.random() * -40);
    let frames = 0;
    (function draw() {
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#8FE24B';
      ctx.font = '15px monospace';
      drops.forEach((y, i) => {
        ctx.fillText(String.fromCharCode(0x30a0 + Math.random() * 96), i * 16, y * 16);
        drops[i] = y * 16 > h && Math.random() > 0.96 ? 0 : y + 1;
      });
      if (++frames < 300) requestAnimationFrame(draw);
      else cv.remove();
    })();
  }

  /* ======================================================================
     3. Friday deploy
     ====================================================================== */
  const crashOv = $('crashOv'),
    crashOut = $('crashOut'),
    crashIn = $('crashIn'),
    pager = $('pager');
  const inc = { active: false, t0: 0, reverted: false, forced: false, logSeen: false, done: false, hintT: 0, fx: 0, timers: [] };
  const cp = (html) => {
    crashOut.insertAdjacentHTML('beforeend', html + '\n');
    crashOut.scrollTop = crashOut.scrollHeight;
  };
  const later = (fn, ms) => {
    const t = setTimeout(fn, ms);
    inc.timers.push(t);
    return t;
  };
  const mmss = (ms) => {
    const s = Math.round(ms / 1000);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  };

  function glitchOn() {
    root.classList.add('rk-glitch');
    if (reduceMotion) return;
    const fx = document.createElement('div');
    fx.className = 'rk-glitch-fx';
    fx.id = 'rkGlitchFx';
    const cols = ['rgba(255,0,80,.45)', 'rgba(0,255,230,.4)', 'rgba(255,255,0,.35)'];
    for (let i = 0; i < 9; i++) fx.appendChild(document.createElement('i'));
    document.body.appendChild(fx);
    const bars = fx.children;
    inc.fx = setInterval(() => {
      for (const b of bars) {
        b.style.top = Math.random() * 100 + '%';
        b.style.height = 2 + Math.random() * 14 + '%';
        b.style.background = cols[Math.floor(Math.random() * 3)];
        b.style.transform = 'translateX(' + (Math.random() * 80 - 40) + 'px)';
        b.style.opacity = Math.random() > 0.35 ? 1 : 0;
      }
    }, 90);
  }
  function glitchOff() {
    root.classList.remove('rk-glitch');
    clearInterval(inc.fx);
    const fx = $('rkGlitchFx');
    if (fx) fx.remove();
  }

  function startIncident() {
    if (inc.active) return;
    Object.assign(inc, { active: true, t0: performance.now(), reverted: false, forced: false, logSeen: false, done: false });
    closeOvs();
    $('crashNo').textContent = String(4000 + Math.floor(Math.random() * 900));
    crashOut.innerHTML = '';
    pager.classList.remove('acked');
    $('pagerAck').textContent = 'ACK';
    glitchOn();
    if (window.__sfx) [0, 150, 300].forEach((d) => setTimeout(() => window.__sfx.blip(), d));
    if (navigator.vibrate) navigator.vibrate([120, 80, 120, 80, 200]);
    later(() => pager.classList.add('show'), 700);
    later(() => {
      glitchOff();
      openIncidentConsole();
    }, 2300);
  }

  async function openIncidentConsole() {
    crashOv.classList.add('open');
    const lines = [
      '<span class="bad">Uncaught TypeError:</span> Cannot read properties of undefined (reading <span class="y">\'weekend\'</span>)',
      '<span class="stack">    at deployToProduction (release.js:59:16)</span>',
      '<span class="stack">    at onFridayAfternoon (calendar.js:4:59)</span>',
      '<span class="stack">    at Object.confidence (ego.js:1:1)</span>',
      '',
      '<span class="bad">✖ HEALTHCHECK FAILED</span> — prod is down. <span class="d">(it is not you. it is HEAD.)</span>',
      '',
      'You are on-call. Fix it. Real commands only.',
      '<span class="d">hint: start with</span> <span class="y">git log</span>',
      '',
    ];
    for (const l of lines) {
      if (!inc.active) return;
      cp(l);
      if (!reduceMotion) await sleep(l ? 170 : 60);
    }
    crashIn.value = '';
    crashIn.focus();
    armHint();
  }

  function armHint() {
    clearTimeout(inc.hintT);
    inc.hintT = setTimeout(() => {
      if (!inc.active || inc.done) return;
      cp('<span class="d">…still down. ' + nextHint() + '</span>');
      armHint();
    }, 24000);
  }
  function nextHint() {
    if (!inc.logSeen && !inc.reverted) return 'try <span class="y">git log</span> to find the culprit.';
    if (!inc.reverted) return 'undo the bad commit safely: <span class="y">git revert HEAD</span>';
    return 'ship the fix: <span class="y">git push</span>';
  }

  function incidentCmd(raw) {
    const cmd = raw.trim().replace(/\s+/g, ' ');
    const low = cmd.toLowerCase();
    cp('<span class="g">oncall@prod:~$</span> ' + esc(cmd));
    if (!low) return;
    if (/^(exit|quit|giveup|give up)$/.test(low)) return abortIncident();
    if (/^(help|hint|\?)$/.test(low)) return cp('<span class="d">' + nextHint() + '</span>');
    if (/^git log\b/.test(low)) {
      inc.logSeen = true;
      cp(
        '<span class="hash">f00dbab</span> <span class="y">(HEAD -&gt; main, origin/main)</span> deploy: friday 16:59 — "what could go wrong"\n<span class="hash">a1b2c3d</span> ship: 90% faster incident diagnosis\n<span class="hash">9f8e7d6</span> fix: orders 20% faster\n<span class="hash">0000001</span> init: hello world',
      );
      return cp('<span class="d">that top commit looks guilty. undo it safely →</span> <span class="y">git revert HEAD</span>');
    }
    if (/^git status\b/.test(low)) return cp('On branch main\nnothing to commit — <span class="bad">production, however, is on fire.</span>');
    if (/^git blame\b/.test(low)) return cp('<span class="hash">f00dbab</span> (<span class="y">visitor</span> 4:59pm Friday) deploy to production\n<span class="d">it was you. you pressed the button.</span>');
    if (/^git revert\b/.test(low)) {
      if (!/\b(head|f00dbab)\b/.test(low)) return cp('<span class="c">wrong commit!</span> you just reverted the 90% win. 😱 <span class="d">(undone — the culprit is HEAD)</span>');
      if (inc.reverted) return cp('already reverted. <span class="d">now: ' + nextHint() + '</span>');
      inc.reverted = true;
      return cp(
        '[main <span class="hash">7e57ed1</span>] Revert "deploy: friday 16:59 — what could go wrong"\n 1 file changed, 1 insertion(+), 59 deletions(-)\n<span class="d">reverted locally. now ship it →</span> <span class="y">git push</span>',
      );
    }
    if (/^git reset --hard (head~1|head\^|a1b2c3d)/.test(low)) {
      inc.reverted = true;
      inc.forced = true;
      return cp(
        'HEAD is now at <span class="hash">a1b2c3d</span> ship: 90% faster incident diagnosis\n<span class="c">…you just rewrote history on a shared branch. 😬</span> <span class="d">(revert is kinder.) you will need</span> <span class="y">git push --force</span>',
      );
    }
    if (/^(git push|deploy)\b/.test(low)) {
      if (!inc.reverted) return cp('Everything up-to-date. <span class="bad">prod is STILL on fire.</span> 🔥 <span class="d">' + nextHint() + '</span>');
      if (inc.forced && !/(--force|-f)\b/.test(low)) return cp('<span class="c">! [rejected] main -&gt; main (non-fast-forward)</span>\n<span class="d">you rewrote history, so:</span> <span class="y">git push --force</span>');
      return void recoverIncident();
    }
    if (/^(rollback|undo|ctrl\+?z)$/.test(low)) return cp('this is git, not a text editor. <span class="d">try</span> <span class="y">git revert HEAD</span>');
    if (/^(sudo|rm|vim|emacs)\b/.test(low)) return cp('<span class="c">on-call tip:</span> you are here to fix production, not to make a second incident. 😅');
    if (/^(ls|pwd|cat|cd)\b/.test(low)) return cp('<span class="d">the repo is fine. the deploy was the problem.</span>');
    cp('<span class="c">command not found:</span> ' + esc(cmd.split(' ')[0]) + '  <span class="d">(' + nextHint() + ')</span>');
  }

  async function recoverIncident() {
    inc.done = true;
    clearTimeout(inc.hintT);
    crashIn.disabled = true;
    const took = performance.now() - inc.t0;
    const steps = [
      'Enumerating objects… <span class="d">done.</span>',
      '<span class="ok">✔</span> CI passed <span class="d">(tests: 112/112)</span>',
      '<span class="ok">✔</span> deployed to prod-web-01',
      '<span class="ok">✔</span> healthcheck <span class="ok">200 OK</span>',
      '',
      '<span class="mttr">INCIDENT RESOLVED\nMTTR: ' + mmss(took) + '\nroot cause: Friday\naction item: never again (see you next Friday)</span>',
    ];
    for (const s of steps) {
      cp(s);
      if (!reduceMotion) await sleep(380);
    }
    burstConfetti(window.innerWidth / 2, window.innerHeight / 2);
    setTimeout(() => burstConfetti(window.innerWidth * 0.3, window.innerHeight * 0.4), 250);
    setTimeout(() => burstConfetti(window.innerWidth * 0.7, window.innerHeight * 0.4), 450);
    pager.classList.add('acked');
    ach('pager');
    later(() => {
      cleanupIncident();
      showToast('✅ site restored in ' + mmss(took) + ' — you would make a fine on-call', 3600);
    }, 2600);
  }

  function abortIncident() {
    cleanupIncident();
    showToast('🤖 on-call bot auto-rolled back. next time: git revert HEAD', 3600);
  }

  function cleanupIncident() {
    inc.active = false;
    inc.timers.forEach(clearTimeout);
    inc.timers = [];
    clearTimeout(inc.hintT);
    glitchOff();
    pager.classList.remove('show', 'acked');
    crashOv.classList.remove('open');
    crashIn.disabled = false;
    crashIn.blur();
  }

  crashIn.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const v = crashIn.value;
    crashIn.value = '';
    incidentCmd(v);
    armHint();
  });
  $('crashGiveUp').addEventListener('click', abortIncident);
  $('pagerAck').addEventListener('click', () => {
    pager.classList.add('acked');
    $('pagerAck').textContent = 'ACK’d';
    if (crashOv.classList.contains('open')) crashIn.focus();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && inc.active) abortIncident();
  });
  $('deployBtn').addEventListener('click', startIncident);
  cmds.push(['🚀', 'Deploy to production (it’s Friday)', 'incident pager friday deploy', startIncident]);

  /* ======================================================================
     4. Theme drawer
     ====================================================================== */
  const DEFAULT = { sh: 8, bw: 3, r: 100 };
  const DEFAULT_HUE = 235;
  const PRESETS = {
    default: { label: 'default', vars: {}, k: DEFAULT },
    retro99: {
      label: '1999 GeoCities',
      cls: 'theme-retro99',
      k: { sh: 4, bw: 2, r: 0 },
      vars: {
        '--brand': '#00a8a8',
        '--brand-dark': '#007a7a',
        '--ink': '#1a0033',
        '--paper': '#ffffcc',
        '--paper2': '#ccffff',
        '--white': '#ffffff',
        '--coral': '#ff00ff',
        '--yellow': '#ffff00',
        '--green': '#00ff00',
        '--purple': '#9966ff',
        '--font-display': "Impact, 'Arial Black', sans-serif",
        '--font-ui': "'Comic Sans MS', 'Comic Sans', cursive",
        '--font-body': "'Times New Roman', Times, serif",
        '--font-mono': "'Courier New', Courier, monospace",
      },
    },
    amber: {
      label: 'terminal amber',
      cls: 'theme-amber',
      k: { sh: 0, bw: 2, r: 0 },
      vars: {
        '--brand': '#ffb000',
        '--brand-dark': '#cc8a00',
        '--ink': '#1a1000',
        '--paper': '#fff1cc',
        '--paper2': '#ffe3a3',
        '--white': '#fff8e6',
        '--coral': '#ff7a00',
        '--yellow': '#ffd24d',
        '--green': '#ffb000',
        '--purple': '#e0a100',
        '--font-display': "'IBM Plex Mono', monospace",
        '--font-ui': "'IBM Plex Mono', monospace",
        '--font-body': "'IBM Plex Mono', monospace",
      },
    },
    gameboy: {
      label: 'game boy',
      cls: 'theme-gameboy',
      font: 'https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400;600;700&display=swap',
      k: { sh: 4, bw: 3, r: 0 },
      vars: {
        '--brand': '#8bac0f',
        '--brand-dark': '#6f8c0c',
        '--ink': '#0f380f',
        '--paper': '#9bbc0f',
        '--paper2': '#8bac0f',
        '--white': '#c9dc84',
        '--coral': '#6f8c0c',
        '--yellow': '#c9dc84',
        '--green': '#306230',
        '--purple': '#8bac0f',
        '--font-ui': "'Pixelify Sans', monospace",
        '--font-body': "'Pixelify Sans', monospace",
        '--font-mono': "'Pixelify Sans', monospace",
      },
    },
  };
  const hsl = (h, s, l) => {
    s /= 100;
    l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => {
      const k = (n + h / 30) % 12;
      const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
      return Math.round(255 * c)
        .toString(16)
        .padStart(2, '0');
    };
    return '#' + f(0) + f(8) + f(4);
  };

  const T = { preset: 'default', hue: null, sh: DEFAULT.sh, bw: DEFAULT.bw, r: DEFAULT.r };
  let applied = [];
  const els = {
    btn: $('tweakBtn'),
    drawer: $('tweakDrawer'),
    presets: $('twPresets'),
    hue: $('twHue'),
    sh: $('twSh'),
    bw: $('twBw'),
    r: $('twR'),
    code: $('twCode'),
  };

  function loadFont(url) {
    if (!url || document.querySelector('link[data-rk-font="' + url + '"]')) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = url;
    l.dataset.rkFont = url;
    document.head.appendChild(l);
  }

  function themeVars() {
    const p = PRESETS[T.preset];
    const v = Object.assign({}, p.vars);
    if (T.hue !== null) {
      v['--brand'] = hsl(T.hue, 100, 62);
      v['--brand-dark'] = hsl(T.hue, 80, 50);
    }
    if (T.sh !== DEFAULT.sh) v['--sh-k'] = String(+(T.sh / 8).toFixed(3));
    if (T.bw !== DEFAULT.bw) v['--bw-k'] = String(+(T.bw / 3).toFixed(3));
    if (T.r !== DEFAULT.r) v['--r-k'] = String(+(T.r / 100).toFixed(3));
    return v;
  }

  function applyTheme(save) {
    applied.forEach((n) => root.style.removeProperty(n));
    Object.keys(PRESETS).forEach((k) => PRESETS[k].cls && root.classList.remove(PRESETS[k].cls));
    const p = PRESETS[T.preset];
    if (p.cls) root.classList.add(p.cls);
    loadFont(p.font);
    const v = themeVars();
    applied = Object.keys(v);
    applied.forEach((n) => root.style.setProperty(n, v[n]));
    const brand = v['--brand'] || '#3b4cff';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', brand);
    syncControls(v, brand);
    if (save) store.set('rk-theme', JSON.stringify(T));
  }

  function syncControls(v, brand) {
    els.sh.value = T.sh;
    els.bw.value = T.bw;
    els.r.value = T.r;
    els.hue.value = T.hue !== null ? T.hue : DEFAULT_HUE;
    $('twShOut').textContent = T.sh + 'px';
    $('twBwOut').textContent = T.bw + 'px';
    $('twROut').textContent = T.r + '%';
    $('twHueOut').textContent = brand;
    Array.from(els.presets.children).forEach((b) => b.classList.toggle('on', b.dataset.k === T.preset));
    const lines = Object.keys(v).map((n) => '  ' + n + ': ' + v[n] + ';');
    if (!lines.length) lines.push('  /* default theme — move a slider */');
    els.code.textContent = ':root {\n' + lines.join('\n') + '\n}';
  }

  Object.keys(PRESETS).forEach((k) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.k = k;
    b.textContent = PRESETS[k].label;
    b.addEventListener('click', () => {
      const p = PRESETS[k];
      Object.assign(T, { preset: k, hue: null, sh: p.k.sh, bw: p.k.bw, r: p.k.r });
      applyTheme(true);
      if (k !== 'default') ach('stylist');
    });
    els.presets.appendChild(b);
  });
  const slider = (el, key) =>
    el.addEventListener('input', () => {
      T[key] = key === 'hue' ? +el.value : +el.value;
      applyTheme(true);
      ach('stylist');
    });
  slider(els.hue, 'hue');
  slider(els.sh, 'sh');
  slider(els.bw, 'bw');
  slider(els.r, 'r');

  function openDrawer() {
    closeOvs();
    els.drawer.classList.add('open');
    els.drawer.setAttribute('aria-hidden', 'false');
    els.btn.setAttribute('aria-expanded', 'true');
  }
  function closeDrawer() {
    els.drawer.classList.remove('open');
    els.drawer.setAttribute('aria-hidden', 'true');
    els.btn.setAttribute('aria-expanded', 'false');
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }
  els.btn.addEventListener('click', () => (els.drawer.classList.contains('open') ? closeDrawer() : openDrawer()));
  $('twX').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDrawer();
  });
  $('twReset').addEventListener('click', () => {
    Object.assign(T, { preset: 'default', hue: null, sh: DEFAULT.sh, bw: DEFAULT.bw, r: DEFAULT.r });
    store.del('rk-theme');
    applyTheme(false);
    showToast('theme reset', 1600);
  });
  $('twRand').addEventListener('click', () => {
    Object.assign(T, {
      preset: 'default',
      hue: Math.floor(Math.random() * 360),
      sh: Math.floor(Math.random() * 15),
      bw: 1 + Math.floor(Math.random() * 12) / 2,
      r: Math.floor(Math.random() * 41) * 5,
    });
    applyTheme(true);
    ach('stylist');
  });
  $('twCopy').addEventListener('click', () => {
    const css = els.code.textContent;
    const done = () => showToast('🎨 theme copied — paste it over :root in styles.css', 2800);
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(css).then(done, done);
    else {
      const ta = document.createElement('textarea');
      ta.value = css;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch (e) {
        /* ignore */
      }
      ta.remove();
      done();
    }
  });
  // restore a saved theme
  (function () {
    try {
      const s = JSON.parse(store.get('rk-theme') || 'null');
      if (s && PRESETS[s.preset]) Object.assign(T, s);
    } catch (e) {
      /* ignore bad data */
    }
    applyTheme(false);
  })();
  cmds.push(['🎨', 'Tweak the theme', 'theme colors restyle presets', openDrawer]);
  const baseTheme = TC.theme;
  TC.theme = (a) => {
    const name = (a[0] || '').toLowerCase();
    if (!name) {
      tp('themes: ' + Object.keys(PRESETS).join(' · ') + '  <span class="d">(or run “theme” with no args to toggle GOLD)</span>');
      return baseTheme();
    }
    const key = Object.keys(PRESETS).find((k) => k === name || PRESETS[k].label.toLowerCase().replace(/\s+/g, '') === name.replace(/\s+/g, ''));
    if (!key) return tp('unknown theme. try: ' + Object.keys(PRESETS).join(', '));
    const p = PRESETS[key];
    Object.assign(T, { preset: key, hue: null, sh: p.k.sh, bw: p.k.bw, r: p.k.r });
    applyTheme(true);
    ach('stylist');
    tp('theme → <span class="g">' + p.label + '</span>');
  };

  /* ======================================================================
     5. Live cursors (other visitors)
     ====================================================================== */
  (function liveCursors() {
    const finePointer = window.matchMedia('(hover:hover) and (pointer:fine)').matches;
    const pill = $('presence'),
      pillTxt = $('presTxt');
    const ADJ = ['curious', 'async', 'lazy', 'swift', 'sleepy', 'caffeinated', 'nullable', 'recursive'];
    const ANI = ['otter', 'gopher', 'crab', 'panda', 'fox', 'owl', 'llama', 'newt'];
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const me = {
      id: Math.random().toString(36).slice(2, 10),
      name: pick(ADJ) + '-' + pick(ANI),
      hue: Math.floor(Math.random() * 360),
    };
    const layer = document.createElement('div');
    layer.className = 'peer-layer';
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);
    const peers = new Map();
    let show = store.get('rk-peers') !== 'off';
    let ws = null,
      bc = null,
      wsOpen = false,
      lastSend = 0,
      mx = 0.5,
      my = 0.5,
      lastMove = 0;

    const docH = () => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, 1);
    const scrollY = () => window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
    const arrow = (c) =>
      '<svg viewBox="0 0 22 22"><path d="M3 2 L3 17 L7 13.5 L10 20 L12.6 18.8 L9.7 12.4 L15 12 Z" fill="' +
      c +
      '" stroke="#0b0b0f" stroke-width="1.8" stroke-linejoin="round"/></svg>';

    function send(type) {
      const msg = JSON.stringify({ t: type, id: me.id, n: me.name, h: me.hue, x: mx, y: my });
      if (ws && wsOpen) ws.send(msg);
      if (bc) bc.postMessage(msg);
    }
    function receive(raw) {
      let d;
      try {
        d = JSON.parse(raw);
      } catch (e) {
        return;
      }
      if (!d || typeof d.id !== 'string' || d.id === me.id || d.id.length > 16) return;
      if (d.t === 'leave') return dropPeer(d.id);
      const name = String(d.n || 'visitor').slice(0, 24);
      const hue = clamp(+d.h || 0, 0, 360);
      let p = peers.get(d.id);
      if (!p) {
        const el = document.createElement('div');
        el.className = 'peer';
        el.style.setProperty('--peer-c', hsl(hue, 100, 70));
        el.innerHTML = arrow(hsl(hue, 100, 70));
        const label = document.createElement('span');
        label.textContent = name;
        el.appendChild(label);
        layer.appendChild(el);
        p = { el, x: 0.5, y: 0.5, seen: 0 };
        peers.set(d.id, p);
        if (show) showToast('👋 ' + name + ' just joined', 1800);
      }
      p.x = clamp(+d.x || 0, 0, 1);
      p.y = clamp(+d.y || 0, 0, 1);
      p.seen = performance.now();
      place(p);
      updatePill();
    }
    function place(p) {
      const w = window.innerWidth,
        h = window.innerHeight;
      const px = p.x * w;
      const py = p.y * docH() - scrollY();
      const onScreen = py >= -10 && py <= h + 10;
      const cy = clamp(py, 126, h - 60); // keep off-screen peers visible, below the nav
      p.el.classList.toggle('edge', !onScreen);
      p.el.style.transform = 'translate3d(' + clamp(px, 4, w - 90) + 'px,' + cy + 'px,0)';
      p.el.style.display = show ? '' : 'none';
    }
    function dropPeer(id) {
      const p = peers.get(id);
      if (!p) return;
      p.el.remove();
      peers.delete(id);
      updatePill();
    }
    function updatePill() {
      const n = peers.size;
      pill.classList.toggle('alone', n === 0);
      pill.classList.toggle('hidden-peers', !show);
      pillTxt.textContent =
        n === 0
          ? 'just you · open a 2nd tab to see cursors'
          : n + 1 + ' here now' + (show ? '' : ' · cursors hidden');
    }
    // prune quiet peers
    setInterval(() => {
      const now = performance.now();
      peers.forEach((p, id) => {
        if (now - p.seen > 7000) dropPeer(id);
      });
      if (document.visibilityState === 'visible') send('ping');
    }, 2500);

    // transport
    if (REALTIME_HOST) {
      try {
        ws = new WebSocket('wss://' + REALTIME_HOST + '/party/' + REALTIME_ROOM);
        ws.onopen = () => {
          wsOpen = true;
          send('ping');
        };
        ws.onmessage = (e) => receive(e.data);
        ws.onclose = () => {
          wsOpen = false;
        };
      } catch (e) {
        ws = null;
      }
    }
    if (!REALTIME_HOST && 'BroadcastChannel' in window) {
      bc = new BroadcastChannel('rk-portfolio-cursors');
      bc.onmessage = (e) => receive(e.data);
    }
    function tick(e) {
      const now = performance.now();
      if (e) {
        mx = clamp(e.clientX / window.innerWidth, 0, 1);
        my = clamp((e.clientY + scrollY()) / docH(), 0, 1);
      }
      lastMove = now;
      if (now - lastSend < 40) return;
      lastSend = now;
      send('m');
    }
    if (finePointer) {
      window.addEventListener('mousemove', tick, { passive: true });
      window.addEventListener('scroll', () => {
        peers.forEach(place);
      }, { passive: true });
    }
    window.addEventListener('resize', () => peers.forEach(place));
    window.addEventListener('pagehide', () => send('leave'));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') send('leave');
    });
    function toggle() {
      show = !show;
      store.set('rk-peers', show ? 'on' : 'off');
      peers.forEach(place);
      updatePill();
      showToast(show ? '👥 other visitors’ cursors: on' : 'other visitors’ cursors: hidden', 1800);
    }
    pill.addEventListener('click', toggle);
    cmds.push(['👥', 'Toggle other visitors’ cursors', 'multiplayer presence live', toggle]);
    updatePill();
    // expose a tiny hook for tests
    window.__rkPeers = { count: () => peers.size, me };
  })();
})();
