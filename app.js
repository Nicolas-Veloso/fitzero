/**
 * @file app.js
 * @description Orquestrador do PWA Core, Interface Mobile-First, Navegação por Abas,
 * Filtro de Ambiente ("Quarto / Laje" vs. "Praça / Barras"), Gaveta de Detalhes com
 * Vetores Anatômicos SVG e Integração com o Storage Manager LGPD — FitZero.
 * Responsáveis: Dev 1 [PWA-01..03] & Dev 2 [UI-01..03]
 */

import {
  getWorkoutHistory,
  saveWorkoutRecord,
  getWorkoutStats,
  exportUserData,
  importUserData,
  clearUserData
} from './storage.js';
import { SESSION_STATES, WorkoutSession } from './workout-session.js';

const HIGH_CONTRAST_KEY = 'fitzero_high_contrast';

const state = {
  exercises: [],
  currentEnv: 'casa',
  currentFocus: 'todos',
  activeExerciseId: null,
  lastFocusedTrigger: null,
  deferredInstallPrompt: null
};

/**
 * Biblioteca de Vetores Anatômicos SVG Inline Otimizados (< 2 KB cada)
 * Destaca: Músculo Ativo (--accent), Eixo da Coluna (--accent-teal) e Base de Apoio (--warning)
 */
function getExerciseAnatomySvg(exerciseId) {
  const vectors = {
    'flexao-parede-solo': `
      <svg viewBox="0 0 240 140" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <!-- Linha de Solo -->
        <line x1="20" y1="118" x2="220" y2="118" stroke="var(--border-strong)" stroke-width="2"/>
        <!-- Pontos de Apoio (Mãos e Ponta dos Pés) -->
        <circle cx="68" cy="114" r="6" fill="var(--warning)"/>
        <circle cx="192" cy="114" r="6" fill="var(--warning)"/>
        <!-- Eixo Neutro da Coluna e Pernas -->
        <line x1="62" y1="62" x2="192" y2="112" stroke="var(--accent-teal)" stroke-width="4" stroke-linecap="round"/>
        <!-- Cabeça Alinhada -->
        <circle cx="50" cy="56" r="10" stroke="var(--text-primary)" stroke-width="3"/>
        <!-- Grupo Muscular Ativo: Peitoral, Deltoide Anterior e Tríceps -->
        <path class="svg-muscle-highlight" d="M64 62 L88 72 L78 92 L68 114" stroke="var(--accent)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
        <ellipse class="svg-muscle-highlight" cx="82" cy="70" rx="14" ry="7" transform="rotate(21 82 70)" fill="var(--accent)" fill-opacity="0.35"/>
        <!-- Vetor de Força (Empurrar o Chão) -->
        <path class="svg-force-arrow" d="M68 102 V34 M62 42 L68 32 L74 42" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,

    'agachamento-livre': `
      <svg viewBox="0 0 240 140" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <!-- Linha de Solo -->
        <line x1="30" y1="122" x2="210" y2="122" stroke="var(--border-strong)" stroke-width="2"/>
        <!-- Apoio Plantar Completo (Calcanhares firmes) -->
        <rect x="108" y="115" width="24" height="7" rx="3" fill="var(--warning)"/>
        <!-- Eixo Neutro da Coluna -->
        <line x1="104" y1="38" x2="88" y2="78" stroke="var(--accent-teal)" stroke-width="4" stroke-linecap="round"/>
        <!-- Cabeça e Braços à Frente para Equilíbrio -->
        <circle cx="108" cy="24" r="9" stroke="var(--text-primary)" stroke-width="3"/>
        <line x1="102" y1="44" x2="144" y2="48" stroke="var(--text-secondary)" stroke-width="3" stroke-linecap="round"/>
        <!-- Grupo Muscular Ativo: Quadríceps e Glúteos -->
        <path class="svg-muscle-highlight" d="M88 78 L128 84 L116 116" stroke="var(--accent)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
        <circle class="svg-muscle-highlight" cx="88" cy="80" r="8" fill="var(--accent)" fill-opacity="0.4"/>
        <!-- Vetor de Força Vertical -->
        <path class="svg-force-arrow" d="M158 106 V40 M152 48 L158 38 L164 48" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,

    'prancha-isometrica': `
      <svg viewBox="0 0 240 140" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <!-- Linha de Solo -->
        <line x1="20" y1="116" x2="220" y2="116" stroke="var(--border-strong)" stroke-width="2"/>
        <!-- Pontos de Apoio: Antebraço e Pés -->
        <rect x="52" y="109" width="28" height="7" rx="3" fill="var(--warning)"/>
        <circle cx="190" cy="111" r="6" fill="var(--warning)"/>
        <!-- Eixo Reto da Coluna ao Calcanhar -->
        <line x1="60" y1="78" x2="190" y2="108" stroke="var(--accent-teal)" stroke-width="4" stroke-linecap="round"/>
        <!-- Apoio de Cotovelo 90 graus -->
        <line x1="64" y1="78" x2="64" y2="112" stroke="var(--text-primary)" stroke-width="4" stroke-linecap="round"/>
        <circle cx="46" cy="74" r="9" stroke="var(--text-primary)" stroke-width="3"/>
        <!-- Grupo Muscular Ativo: Core / Parede Abdominal -->
        <path class="svg-muscle-highlight" d="M78 84 L142 98" stroke="var(--accent)" stroke-width="8" stroke-linecap="round"/>
        <!-- Vetor Anti-Gravidade no Core -->
        <path class="svg-force-arrow" d="M112 112 V62 M106 70 L112 60 L118 70" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,

    'remada-australiana-praca': `
      <svg viewBox="0 0 240 140" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <!-- Estrutura da Barra Baixa da Praça -->
        <line x1="88" y1="24" x2="88" y2="122" stroke="var(--border-strong)" stroke-width="3"/>
        <line x1="20" y1="122" x2="220" y2="122" stroke="var(--border-strong)" stroke-width="2"/>
        <!-- Pontos de Apoio: Pegada na Barra e Calcanhares no Solo -->
        <circle cx="88" cy="48" r="7" fill="var(--warning)"/>
        <circle cx="178" cy="116" r="6" fill="var(--warning)"/>
        <!-- Eixo Neutro do Corpo em Suspensão Inclinada -->
        <line x1="78" y1="68" x2="178" y2="116" stroke="var(--accent-teal)" stroke-width="4" stroke-linecap="round"/>
        <circle cx="66" cy="60" r="9" stroke="var(--text-primary)" stroke-width="3"/>
        <!-- Grupo Muscular Ativo: Dorsais, Escápulas e Bíceps -->
        <path class="svg-muscle-highlight" d="M88 48 L104 68 L86 76" stroke="var(--accent)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
        <!-- Vetor de Puxada Escapular -->
        <path class="svg-force-arrow" d="M126 96 L96 58 M96 68 L94 56 L106 60" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,

    'barra-fixa-escapular': `
      <svg viewBox="0 0 240 140" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <!-- Barra Alta da Praça -->
        <line x1="50" y1="18" x2="190" y2="18" stroke="var(--border-strong)" stroke-width="4" stroke-linecap="round"/>
        <!-- Pontos de Apoio: Pegada Firme na Barra -->
        <circle cx="96" cy="18" r="6" fill="var(--warning)"/>
        <circle cx="144" cy="18" r="6" fill="var(--warning)"/>
        <!-- Braços Estendidos -->
        <line x1="96" y1="18" x2="106" y2="52" stroke="var(--text-primary)" stroke-width="3.5" stroke-linecap="round"/>
        <line x1="144" y1="18" x2="134" y2="52" stroke="var(--text-primary)" stroke-width="3.5" stroke-linecap="round"/>
        <!-- Cabeça e Coluna Alinhada -->
        <circle cx="120" cy="40" r="9" stroke="var(--text-primary)" stroke-width="3"/>
        <line x1="120" y1="52" x2="120" y2="122" stroke="var(--accent-teal)" stroke-width="4" stroke-linecap="round"/>
        <!-- Grupo Muscular Ativo: Cintura Escapular e Grande Dorsal -->
        <path class="svg-muscle-highlight" d="M104 54 H136 L128 76 H112 Z" fill="var(--accent)" fill-opacity="0.38" stroke="var(--accent)" stroke-width="3" stroke-linejoin="round"/>
        <!-- Vetor de Depressão Escapular (Ombros para baixo) -->
        <path class="svg-force-arrow" d="M82 44 V78 M76 70 L82 80 L88 70" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,

    'afundo-estatico-banco': `
      <svg viewBox="0 0 240 140" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <!-- Linha de Solo e Banco da Praça para Apoio -->
        <line x1="20" y1="122" x2="220" y2="122" stroke="var(--border-strong)" stroke-width="2"/>
        <path d="M52 72 H76 V122" stroke="var(--border-strong)" stroke-width="3" stroke-linecap="round"/>
        <!-- Pontos de Apoio: Mão no Banco, Pé da Frente e Ponta do Pé de Trás -->
        <circle cx="76" cy="72" r="5" fill="var(--warning)"/>
        <rect x="108" y="115" width="20" height="7" rx="3" fill="var(--warning)"/>
        <circle cx="174" cy="116" r="5" fill="var(--warning)"/>
        <!-- Coluna Vertical Alinhada -->
        <line x1="120" y1="36" x2="120" y2="80" stroke="var(--accent-teal)" stroke-width="4" stroke-linecap="round"/>
        <circle cx="120" cy="22" r="9" stroke="var(--text-primary)" stroke-width="3"/>
        <line x1="120" y1="48" x2="76" y2="72" stroke="var(--text-secondary)" stroke-width="3" stroke-linecap="round"/>
        <!-- Grupo Muscular Ativo: Pernas em Ângulo de 90 Graus -->
        <path class="svg-muscle-highlight" d="M120 80 L116 116 M120 80 L146 112 L174 116" stroke="var(--accent)" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>
        <!-- Vetor de Controle Vertical -->
        <path class="svg-force-arrow" d="M188 98 V42 M182 50 L188 40 L194 50" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`
  };

  return (
    vectors[exerciseId] ||
    `<svg viewBox="0 0 240 140" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <line x1="30" y1="118" x2="210" y2="118" stroke="var(--border-strong)" stroke-width="2"/>
      <circle cx="120" cy="32" r="10" stroke="var(--text-primary)" stroke-width="3"/>
      <line x1="120" y1="44" x2="120" y2="90" stroke="var(--accent-teal)" stroke-width="4" stroke-linecap="round"/>
      <path class="svg-muscle-highlight" d="M92 58 L120 48 L148 58" stroke="var(--accent)" stroke-width="5" stroke-linecap="round"/>
      <circle cx="104" cy="114" r="6" fill="var(--warning)"/>
      <circle cx="136" cy="114" r="6" fill="var(--warning)"/>
    </svg>`
  );
}

/**
 * Classifica o grupo muscular do exercício para o filtro rápido de chips ([UI-03])
 */
function matchesMuscleFocus(exercise, focusFilter) {
  if (!focusFilter || focusFilter === 'todos') return true;
  const text = `${exercise.foco_muscular || ''} ${exercise.nome_popular || ''}`.toLowerCase();

  if (focusFilter === 'superior') {
    return (
      text.includes('peito') ||
      text.includes('ombro') ||
      text.includes('tríceps') ||
      text.includes('costas') ||
      text.includes('bíceps') ||
      text.includes('braço') ||
      text.includes('pegada')
    );
  }
  if (focusFilter === 'inferior') {
    return (
      text.includes('coxa') ||
      text.includes('glúteo') ||
      text.includes('perna') ||
      text.includes('quadril') ||
      text.includes('agachamento') ||
      text.includes('passada')
    );
  }
  if (focusFilter === 'core') {
    return (
      text.includes('abdômen') ||
      text.includes('lombar') ||
      text.includes('core') ||
      text.includes('postura') ||
      text.includes('estabilidade')
    );
  }
  return true;
}

/**
 * 1. Registro e Monitoramento do Service Worker ([PWA-02])
 */
async function registerServiceWorker() {
  const swBadge = document.getElementById('sw-badge');
  const swDetails = document.getElementById('sw-details');

  if (!('serviceWorker' in navigator)) {
    if (swBadge) swBadge.textContent = 'Indisponível';
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register('./sw.js', {
      scope: './'
    });

    if (swBadge) {
      swBadge.textContent = 'Ativo • fitzero-v1';
    }

    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }

    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          newWorker.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    });

    await navigator.serviceWorker.ready;
    if (navigator.serviceWorker.controller && swDetails) {
      const channel = new MessageChannel();
      channel.port1.onmessage = (event) => {
        if (event.data && event.data.cacheName) {
          swDetails.textContent = `Cache "${event.data.cacheName}" sincronizado com ${event.data.cachedCount} recursos estáticos locais. Operação 100% independente de rede.`;
        }
      };
      navigator.serviceWorker.controller.postMessage(
        { type: 'GET_CACHE_STATUS' },
        [channel.port2]
      );
    }
  } catch (error) {
    console.warn('[PWA] Falha ao registrar Service Worker:', error);
    if (swBadge) swBadge.textContent = 'Modo Local';
  }
}

/**
 * 2. Monitor de Conectividade Online/Offline ([PWA-02])
 */
function setupNetworkMonitor() {
  const badge = document.getElementById('network-status');
  const text = document.getElementById('network-status-text');

  function updateNetworkUI() {
    if (!badge || !text) return;
    const isOnline = navigator.onLine;
    badge.classList.toggle('online', isOnline);
    badge.classList.toggle('offline', !isOnline);
    text.textContent = isOnline ? 'ONLINE' : 'OFFLINE';
  }

  window.addEventListener('online', updateNetworkUI);
  window.addEventListener('offline', updateNetworkUI);
  updateNetworkUI();
}

/**
 * 3. Fluxo de Instalação Nativa A2HS ([PWA-01])
 */
function setupInstallPrompt() {
  const banner = document.getElementById('install-banner');
  const btnInstall = document.getElementById('btn-install-pwa');
  const btnDismiss = document.getElementById('btn-dismiss-install');

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    state.deferredInstallPrompt = event;
    if (banner) {
      banner.classList.remove('hidden');
    }
  });

  if (btnInstall) {
    btnInstall.addEventListener('click', async () => {
      if (!state.deferredInstallPrompt) return;
      state.deferredInstallPrompt.prompt();
      await state.deferredInstallPrompt.userChoice;
      state.deferredInstallPrompt = null;
      if (banner) banner.classList.add('hidden');
    });
  }

  if (btnDismiss) {
    btnDismiss.addEventListener('click', () => {
      if (banner) banner.classList.add('hidden');
    });
  }

  window.addEventListener('appinstalled', () => {
    state.deferredInstallPrompt = null;
    if (banner) banner.classList.add('hidden');
  });
}

/**
 * 4. Navegação de Abas do App Shell ([UI-02]) e Alto Contraste ([UI-01])
 */
function setupNavigationAndTheme() {
  const navButtons = Array.from(document.querySelectorAll('.nav-tab'));
  const panels = document.querySelectorAll('.tab-panel');
  const contrastBtn = document.getElementById('contrast-toggle');

  function activateTab(targetId, moveFocus = false) {
    navButtons.forEach((btn) => {
      const isMatch = btn.dataset.target === targetId;
      btn.classList.toggle('active', isMatch);
      btn.setAttribute('aria-selected', String(isMatch));
      btn.setAttribute('tabindex', isMatch ? '0' : '-1');
      if (isMatch && moveFocus) {
        btn.focus();
      }
    });

    panels.forEach((panel) => {
      panel.classList.toggle('hidden', panel.id !== targetId);
    });
  }

  navButtons.forEach((btn, index) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.target) {
        activateTab(btn.dataset.target, false);
      }
    });

    btn.addEventListener('keydown', (event) => {
      let nextIndex = null;
      if (event.key === 'ArrowRight') {
        nextIndex = (index + 1) % navButtons.length;
      } else if (event.key === 'ArrowLeft') {
        nextIndex = (index - 1 + navButtons.length) % navButtons.length;
      } else if (event.key === 'Home') {
        nextIndex = 0;
      } else if (event.key === 'End') {
        nextIndex = navButtons.length - 1;
      }

      if (nextIndex !== null) {
        event.preventDefault();
        const targetBtn = navButtons[nextIndex];
        if (targetBtn && targetBtn.dataset.target) {
          activateTab(targetBtn.dataset.target, true);
        }
      }
    });
  });

  const hashMap = {
    '#treinar': 'tab-treinar',
    '#historico': 'tab-historico',
    '#postura': 'tab-postura'
  };
  if (window.location.hash && hashMap[window.location.hash]) {
    activateTab(hashMap[window.location.hash]);
  } else {
    activateTab('tab-treinar');
  }

  // Persistência da preferência de Alto Contraste ([UI-01])
  if (contrastBtn) {
    try {
      const savedContrast = window.localStorage.getItem(HIGH_CONTRAST_KEY) === 'true';
      if (savedContrast) {
        document.body.classList.add('high-contrast');
        contrastBtn.setAttribute('aria-pressed', 'true');
      }
    } catch (_) {
      // Ignora caso LocalStorage esteja restrito
    }

    contrastBtn.addEventListener('click', () => {
      const enabled = document.body.classList.toggle('high-contrast');
      contrastBtn.setAttribute('aria-pressed', String(enabled));
      try {
        window.localStorage.setItem(HIGH_CONTRAST_KEY, String(enabled));
      } catch (_) {
        // Ignora erro de escrita
      }
    });
  }
}

/**
 * 5. Gaveta Lateral / Modal Leve de Detalhes do Exercício e Vetor Anatômico ([UI-03])
 */
function setupExerciseDrawer(onStartExercise) {
  const backdrop = document.getElementById('exercise-drawer-backdrop');
  const drawerEl = backdrop ? backdrop.querySelector('.exercise-drawer') : null;
  const btnClose = document.getElementById('btn-close-drawer');
  const btnComplete = document.getElementById('btn-drawer-complete');

  const envBadge = document.getElementById('drawer-exercise-env');
  const levelBadge = document.getElementById('drawer-exercise-level');
  const timeBadge = document.getElementById('drawer-exercise-time');
  const titleEl = document.getElementById('drawer-exercise-title');
  const svgContainer = document.getElementById('drawer-svg-container');
  const focusEl = document.getElementById('drawer-exercise-focus');
  const seriesEl = document.getElementById('drawer-exercise-series');
  const regressionEl = document.getElementById('drawer-exercise-regression');
  const attentionEl = document.getElementById('drawer-exercise-attention');

  function openDrawer(exerciseId, triggerElement) {
    const exercise = state.exercises.find((item) => item.id === exerciseId);
    if (!exercise || !backdrop) return;

    state.activeExerciseId = exercise.id;
    state.lastFocusedTrigger = triggerElement || document.activeElement;

    if (envBadge) {
      envBadge.textContent = exercise.ambiente === 'praca' ? 'Praça / Barras' : 'Quarto / Laje';
    }
    if (levelBadge) {
      levelBadge.textContent = exercise.nivel || 'Iniciante';
    }
    if (timeBadge) {
      timeBadge.textContent = `${exercise.tempo_estimado_min || 10} MIN`;
    }
    if (titleEl) {
      titleEl.textContent = exercise.nome_popular;
    }
    if (svgContainer) {
      svgContainer.innerHTML = getExerciseAnatomySvg(exercise.id);
      svgContainer.setAttribute(
        'aria-label',
        `Ilustração anatômica de ${exercise.nome_popular}: foco em ${exercise.foco_muscular}`
      );
    }
    if (focusEl) {
      focusEl.textContent = exercise.foco_muscular || 'Corpo Inteiro';
    }
    if (seriesEl) {
      seriesEl.textContent = exercise.series_recomendadas || '3 séries controladas';
    }
    if (regressionEl) {
      regressionEl.textContent = exercise.regressao_segura || '';
    }
    if (attentionEl) {
      attentionEl.textContent = exercise.pontos_atencao || '';
    }

    backdrop.classList.remove('hidden');
    document.body.classList.add('drawer-open');

    if (btnClose) {
      btnClose.focus();
    } else if (drawerEl) {
      drawerEl.focus();
    }
  }

  function closeDrawer() {
    if (!backdrop || backdrop.classList.contains('hidden')) return;
    backdrop.classList.add('hidden');
    document.body.classList.remove('drawer-open');
    state.activeExerciseId = null;

    if (state.lastFocusedTrigger && typeof state.lastFocusedTrigger.focus === 'function') {
      state.lastFocusedTrigger.focus();
    }
  }

  if (btnClose) {
    btnClose.addEventListener('click', closeDrawer);
  }

  if (backdrop) {
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) {
        closeDrawer();
      }
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && backdrop && !backdrop.classList.contains('hidden')) {
      event.preventDefault();
      closeDrawer();
    }
  });

  if (btnComplete) {
    btnComplete.addEventListener('click', () => {
      const exercise = state.exercises.find((item) => item.id === state.activeExerciseId);
      if (!exercise) return;

      closeDrawer();
      onStartExercise(exercise);
    });
  }

  return { openDrawer, closeDrawer };
}

function setupWorkoutSession(getRoutineExercises) {
  const session = new WorkoutSession();
  const stateEl = document.getElementById('session-state');
  const titleEl = document.getElementById('workout-session-title');
  const progressEl = document.getElementById('session-progress');
  const messageEl = document.getElementById('session-message');
  const timerArea = document.getElementById('session-timer-area');
  const timerLabel = document.getElementById('session-timer-label');
  const timerEl = document.getElementById('session-timer');
  const repsArea = document.getElementById('session-reps-area');
  const repsEl = document.getElementById('session-reps');
  const repTargetEl = document.getElementById('session-rep-target');
  const startButton = document.getElementById('btn-session-start');
  const completeSetButton = document.getElementById('btn-session-set-complete');
  const pauseButton = document.getElementById('btn-session-pause');
  const resumeButton = document.getElementById('btn-session-resume');
  const skipButton = document.getElementById('btn-session-skip');
  const endButton = document.getElementById('btn-session-end');
  let intervalId = null;
  let startedAt = null;
  let historySaved = false;
  let wakeLock = null;
  let wakeLockRequest = null;
  let wakeLockRequestId = 0;
  let wakeLockWanted = false;

  function show(button, visible) {
    if (button) button.classList.toggle('hidden', !visible);
  }

  function updateWakeLock(snapshot, forceRequest = false) {
    const shouldHold =
      snapshot.state === SESSION_STATES.WORK &&
      !snapshot.paused &&
      document.visibilityState === 'visible';

    if (!shouldHold) {
      if (wakeLockWanted || wakeLock || wakeLockRequest) {
        wakeLockRequestId += 1;
        wakeLockWanted = false;
      }
      if (wakeLock) {
        const currentLock = wakeLock;
        wakeLock = null;
        currentLock.release().catch(() => {});
      }
      return;
    }

    if (wakeLockWanted && !forceRequest) return;
    wakeLockWanted = true;
    if (!navigator.wakeLock?.request || wakeLock || wakeLockRequest) return;

    const requestId = ++wakeLockRequestId;
    const request = navigator.wakeLock.request('screen');
    wakeLockRequest = request;
    request
      .then((lock) => {
        if (
          requestId !== wakeLockRequestId ||
          document.visibilityState !== 'visible' ||
          session.getSnapshot().state !== SESSION_STATES.WORK ||
          session.getSnapshot().paused
        ) {
          return lock.release().catch(() => {});
        }

        wakeLock = lock;
        lock.addEventListener('release', () => {
          if (wakeLock === lock) {
            wakeLock = null;
            wakeLockWanted = false;
            updateWakeLock(session.getSnapshot(), true);
          }
        });
      })
      .catch(() => {})
      .finally(() => {
        if (wakeLockRequest === request) {
          wakeLockRequest = null;
          if (requestId !== wakeLockRequestId) updateWakeLock(session.getSnapshot(), true);
        }
      });
  }

  function start(exercises) {
    if (!exercises.length) {
      if (messageEl) messageEl.textContent = 'Nenhum exercício disponível com os filtros atuais.';
      return;
    }
    const snapshot = session.getSnapshot();
    if (
      snapshot.state !== SESSION_STATES.IDLE &&
      snapshot.state !== SESSION_STATES.FINISHED &&
      !window.confirm('Substituir a sessão em andamento? O progresso atual não será salvo.')
    ) {
      return;
    }
    session.start(exercises);
    startedAt = Date.now();
    historySaved = false;
    if (intervalId) window.clearInterval(intervalId);
    intervalId = window.setInterval(render, 250);
    render();
  }

  function startExercise(exercise) {
    const routine = getRoutineExercises();
    const selectedIndex = routine.findIndex((item) => item.id === exercise.id);
    start(selectedIndex >= 0 ? routine.slice(selectedIndex) : [exercise]);
  }

  function saveCompletedSession(snapshot) {
    if (historySaved) return;
    historySaved = true;
    if (!snapshot.completedExercises.length || !startedAt) return;

    saveWorkoutRecord({
      data_iso: new Date().toISOString(),
      treino_id: 'sessao-fitzero',
      duracao_min: Math.max(1, Math.ceil((Date.now() - startedAt) / 60000)),
      exercicios_concluidos: snapshot.completedExercises
    });
  }

  function render() {
    const snapshot = session.tick();
    const active = snapshot.state !== SESSION_STATES.IDLE && snapshot.state !== SESSION_STATES.FINISHED;
    const exercise = snapshot.exercise;
    const prescription = snapshot.prescription;
    const phaseLabel = snapshot.paused ? `PAUSADO · ${snapshot.state}` : snapshot.state;

    if (stateEl) stateEl.textContent = phaseLabel;
    if (titleEl) {
      titleEl.textContent = exercise
        ? exercise.nome_popular
        : snapshot.state === SESSION_STATES.FINISHED
          ? 'Treino concluído'
          : 'Sessão pronta';
    }
    if (progressEl) {
      progressEl.textContent = exercise
        ? `Exercício ${snapshot.exerciseIndex + 1} de ${snapshot.exerciseCount} · Série ${snapshot.setNumber} de ${snapshot.totalSets}`
        : snapshot.state === SESSION_STATES.FINISHED
          ? `${snapshot.completedExercises.length} exercício(s) concluído(s)`
          : 'Aguardando início';
    }

    if (messageEl) {
      if (snapshot.state === SESSION_STATES.IDLE) {
        const total = getRoutineExercises().length;
        messageEl.textContent = total
          ? `Rotina atual: ${total} exercício(s) conforme ambiente e foco selecionados.`
          : 'Nenhum exercício disponível com os filtros atuais.';
      } else if (snapshot.state === SESSION_STATES.PREPARING) {
        messageEl.textContent = 'Prepare a posição. A série começa em instantes.';
      } else if (snapshot.state === SESSION_STATES.WORK && prescription.kind === 'time') {
        messageEl.textContent = 'Mantenha a posição e respire de forma contínua.';
      } else if (snapshot.state === SESSION_STATES.WORK) {
        messageEl.textContent = `Conte as repetições. Alvo: ${prescription.minimum} a ${prescription.maximum}.`;
      } else if (snapshot.state === SESSION_STATES.REST) {
        messageEl.textContent = snapshot.exerciseComplete
          ? 'Descanso antes do próximo exercício.'
          : 'Descanse antes da próxima série.';
      } else if (snapshot.state === SESSION_STATES.FINISHED) {
        messageEl.textContent = snapshot.completedExercises.length
          ? `${snapshot.completedExercises.length} exercício(s) concluído(s). Sessão registrada no histórico.`
          : 'Sessão encerrada sem séries completas.';
      }
      if (snapshot.paused) messageEl.textContent = 'Sessão pausada. Retome quando estiver pronto.';
    }

    const showTimer = active && snapshot.remainingSeconds !== null;
    show(timerArea, showTimer);
    if (showTimer && timerEl) {
      const minutes = Math.floor(snapshot.remainingSeconds / 60);
      const seconds = snapshot.remainingSeconds % 60;
      timerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      if (timerLabel) {
        timerLabel.textContent = snapshot.state === SESSION_STATES.PREPARING
          ? 'Preparação'
          : snapshot.state === SESSION_STATES.REST
            ? 'Descanso'
            : 'Tempo da série';
      }
    }

    const showReps = active && snapshot.state === SESSION_STATES.WORK && prescription.kind === 'reps';
    show(repsArea, showReps);
    if (showReps) {
      if (repsEl) repsEl.textContent = String(snapshot.repetitions);
      if (repTargetEl) repTargetEl.textContent = `Mínimo ${prescription.minimum} · máximo ${prescription.maximum}`;
    }
    show(startButton, !active);
    if (startButton) startButton.textContent = snapshot.state === SESSION_STATES.FINISHED ? 'Iniciar novamente' : 'Iniciar rotina';
    show(completeSetButton, showReps);
    if (completeSetButton) {
      completeSetButton.disabled = !showReps || snapshot.repetitions < prescription.minimum;
    }
    show(pauseButton, active && !snapshot.paused);
    show(resumeButton, active && snapshot.paused);
    show(skipButton, active);
    show(endButton, active);
    updateWakeLock(snapshot);

    if (snapshot.state === SESSION_STATES.FINISHED) {
      if (intervalId) window.clearInterval(intervalId);
      intervalId = null;
      saveCompletedSession(snapshot);
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') render();
    else updateWakeLock(session.getSnapshot());
  });
  window.addEventListener('pageshow', render);

  if (startButton) startButton.addEventListener('click', () => start(getRoutineExercises()));
  document.getElementById('btn-rep-plus')?.addEventListener('click', () => {
    if (session.addRepetition()) render();
  });
  document.getElementById('btn-rep-minus')?.addEventListener('click', () => {
    if (session.removeRepetition()) render();
  });
  completeSetButton?.addEventListener('click', () => {
    if (session.completeSet()) render();
  });
  pauseButton?.addEventListener('click', () => {
    if (session.pause()) render();
  });
  resumeButton?.addEventListener('click', () => {
    if (session.resume()) render();
  });
  skipButton?.addEventListener('click', () => {
    if (session.skipExercise()) render();
  });
  endButton?.addEventListener('click', () => {
    if (session.end()) render();
  });

  render();
  return { startExercise, refresh: render };
}

/**
 * 6. Carregamento do Catálogo Offline e Renderização dos Cards ([UI-03])
 */
async function loadExercisesCatalog() {
  const listEl = document.getElementById('exercises-list');
  const summaryEl = document.getElementById('env-summary');
  const contextTextEl = document.getElementById('env-context-text');
  const envButtons = document.querySelectorAll('.env-btn');
  const focusChips = document.querySelectorAll('.focus-chip');
  const getRoutineExercises = () =>
    state.exercises
      .filter((exercise) => exercise.ambiente === state.currentEnv)
      .filter((exercise) => matchesMuscleFocus(exercise, state.currentFocus));
  const sessionController = setupWorkoutSession(getRoutineExercises);
  const drawerController = setupExerciseDrawer(sessionController.startExercise);

  try {
    const response = await fetch('./exercises.json');
    const data = await response.json();
    state.exercises = Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn('[PWA] Erro ao carregar exercises.json:', err);
    state.exercises = [];
  }

  function updateEnvContextCopy() {
    if (!contextTextEl) return;
    if (state.currentEnv === 'praca') {
      contextTextEl.textContent =
        'Modo Praça / Barras: exercícios de tração, suspensão escapular e pernas usando barras e bancos públicos.';
    } else {
      contextTextEl.textContent =
        'Modo Quarto / Laje: rotina silenciosa de solo, sem impacto e sem salto, ideal para espaços reduzidos.';
    }
  }

  function renderExercises() {
    if (!listEl) return;

    const envFiltered = state.exercises.filter((ex) => ex.ambiente === state.currentEnv);
    const filtered = envFiltered.filter((ex) => matchesMuscleFocus(ex, state.currentFocus));
    const totalMin = filtered.reduce((acc, ex) => acc + (Number(ex.tempo_estimado_min) || 0), 0);

    if (summaryEl) {
      summaryEl.textContent = `${filtered.length} exercício${filtered.length === 1 ? '' : 's'} • ${totalMin} min`;
    }

    updateEnvContextCopy();

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <article class="card">
          <p class="card-meta" style="margin:0;">Nenhum exercício encontrado para este filtro. Selecione "Todos" para ver a rotina completa do ambiente.</p>
        </article>`;
      sessionController.refresh();
      return;
    }

    listEl.innerHTML = filtered
      .map((ex, idx) => {
        const indexNum = String(idx + 1).padStart(2, '0');
        const envLabel = ex.ambiente === 'praca' ? 'Praça / Barras' : 'Quarto / Laje';
        return `
      <article class="card" data-exercise-id="${escapeHtml(ex.id)}">
        <div class="card-top">
          <div class="card-index-group">
            <span class="card-index">${indexNum}</span>
            <h3 class="card-title">${escapeHtml(ex.nome_popular)}</h3>
          </div>
          <span class="tag tag-accent">${escapeHtml(ex.tempo_estimado_min)} MIN</span>
        </div>

        <div class="card-badges-row" aria-label="Classificação do exercício">
          <span class="tag tag-teal">${escapeHtml(ex.nivel || 'Iniciante')}</span>
          <span class="tag">${escapeHtml(ex.foco_muscular)}</span>
          <span class="tag">${escapeHtml(envLabel)}</span>
        </div>

        <div class="card-visual-row">
          <button
            type="button"
            class="card-thumb-btn btn-open-drawer"
            data-id="${escapeHtml(ex.id)}"
            aria-label="Ver ilustração anatômica e detalhes de ${escapeHtml(ex.nome_popular)}"
            title="Ver vetor anatômico"
          >
            ${getExerciseAnatomySvg(ex.id)}
          </button>

          <div class="specs-grid">
            <div class="spec-box">
              <span class="spec-label">Volume Sugerido</span>
              <span class="spec-value">${escapeHtml(ex.series_recomendadas)}</span>
            </div>
            <div class="spec-box">
              <span class="spec-label">Adaptação Iniciante</span>
              <span class="spec-value">${escapeHtml(ex.regressao_segura)}</span>
            </div>
          </div>
        </div>

        <div class="card-actions">
          <button
            type="button"
            class="btn btn-secondary btn-block btn-open-drawer"
            data-id="${escapeHtml(ex.id)}"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9"/>
              <path d="M12 16v-4M12 8h.01"/>
            </svg>
            <span>Postura &amp; Vetor</span>
          </button>

          <button
            type="button"
            class="btn btn-primary btn-block btn-complete-workout"
            data-id="${escapeHtml(ex.id)}"
          >
            <span>Iniciar exercício</span>
          </button>
        </div>
      </article>`;
      })
      .join('');

    listEl.querySelectorAll('.btn-open-drawer').forEach((btn) => {
      btn.addEventListener('click', () => {
        const exId = btn.getAttribute('data-id');
        if (exId) {
          drawerController.openDrawer(exId, btn);
        }
      });
    });

    listEl.querySelectorAll('.btn-complete-workout').forEach((btn) => {
      btn.addEventListener('click', () => {
        const exId = btn.getAttribute('data-id');
        const exercise = state.exercises.find((item) => item.id === exId);
        if (exercise) sessionController.startExercise(exercise);
      });
    });
    sessionController.refresh();
  }

  envButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.currentEnv = btn.getAttribute('data-env') || 'casa';
      envButtons.forEach((b) => {
        const isCurrent = b === btn;
        b.classList.toggle('active', isCurrent);
        b.setAttribute('aria-pressed', String(isCurrent));
      });
      renderExercises();
    });
  });

  focusChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      state.currentFocus = chip.getAttribute('data-focus') || 'todos';
      focusChips.forEach((c) => {
        const isCurrent = c === chip;
        c.classList.toggle('active', isCurrent);
        c.setAttribute('aria-pressed', String(isCurrent));
      });
      renderExercises();
    });
  });

  renderExercises();
}

/**
 * 7. Integração da Aba Histórico e Portabilidade JSON ([PWA-03])
 */
function setupStorageAndHistoryUI() {
  const totalTreinosEl = document.getElementById('stat-total-treinos');
  const totalMinutosEl = document.getElementById('stat-total-minutos');
  const diasUnicosEl = document.getElementById('stat-dias-unicos');
  const historyListEl = document.getElementById('history-list');
  const feedbackEl = document.getElementById('storage-feedback');

  const btnExport = document.getElementById('btn-export-json');
  const inputImport = document.getElementById('input-import-json');
  const btnClear = document.getElementById('btn-clear-history');

  function showFeedback(message, isError = false) {
    if (!feedbackEl) return;
    feedbackEl.textContent = message;
    feedbackEl.style.borderColor = isError ? 'var(--danger)' : 'var(--accent)';
    feedbackEl.classList.remove('hidden');
  }

  function renderHistory() {
    const stats = getWorkoutStats();
    if (totalTreinosEl) totalTreinosEl.textContent = String(stats.totalTreinos);
    if (totalMinutosEl) totalMinutosEl.textContent = String(stats.totalMinutos);
    if (diasUnicosEl) diasUnicosEl.textContent = String(stats.diasUnicos);

    if (!historyListEl) return;
    const history = getWorkoutHistory();

    if (history.length === 0) {
      historyListEl.innerHTML = `
        <li class="history-item">
          <span class="card-meta" style="margin:0;">Nenhuma sessão registrada ainda. Conclua uma série na aba "Treinar" ou importe um backup JSON.</span>
        </li>`;
      return;
    }

    historyListEl.innerHTML = history
      .map((item) => {
        const formattedDate = new Date(item.data_iso).toLocaleString('pt-BR', {
          dateStyle: 'short',
          timeStyle: 'short'
        });
        const exList = Array.isArray(item.exercicios_concluidos)
          ? item.exercicios_concluidos.join(', ')
          : `${item.exercicios_concluidos} exercício(s)`;

        return `
        <li class="history-item">
          <div>
            <div class="history-item-title">${escapeHtml(exList)}</div>
            <div class="history-item-sub">
              ${escapeHtml(item.treino_id)} • ${escapeHtml(formattedDate)}
            </div>
          </div>
          <span class="tag tag-accent">${escapeHtml(item.duracao_min)} MIN</span>
        </li>`;
      })
      .join('');
  }

  if (btnExport) {
    btnExport.addEventListener('click', () => {
      const result = exportUserData();
      showFeedback(
        `Arquivo "${result.filename}" exportado (${result.count} registro(s)).`
      );
    });
  }

  if (inputImport) {
    inputImport.addEventListener('change', async (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;

      const result = await importUserData(file);
      if (result.success) {
        showFeedback(
          `Importação concluída: ${result.importedCount} novo(s), ${result.skippedCount} preservado(s). Total: ${result.totalCount}.`
        );
      } else {
        showFeedback(result.error || 'Erro ao importar arquivo JSON.', true);
      }
      inputImport.value = '';
    });
  }

  if (btnClear) {
    btnClear.addEventListener('click', () => {
      if (
        window.confirm(
          'Apagar todos os registros locais deste dispositivo? Recomendamos exportar seu backup JSON antes.'
        )
      ) {
        clearUserData();
        showFeedback('Histórico local removido.');
      }
    });
  }

  window.addEventListener('fitzero:history-updated', renderHistory);
  renderHistory();
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

document.addEventListener('DOMContentLoaded', () => {
  setupNavigationAndTheme();
  setupNetworkMonitor();
  setupInstallPrompt();
  setupStorageAndHistoryUI();
  loadExercisesCatalog();
  registerServiceWorker();
});
