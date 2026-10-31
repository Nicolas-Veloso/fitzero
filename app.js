/**
 * @file app.js
 * @description Orquestrador do PWA Core, Registro do Service Worker, Detector de Conectividade,
 * Instalação Nativa (A2HS) e Integração com o Storage Manager LGPD — FitZero.
 * Responsável: Dev 1 (Tech Lead & PWA Core) — [PWA-01, PWA-02, PWA-03]
 */

import {
  getWorkoutHistory,
  saveWorkoutRecord,
  getWorkoutStats,
  exportUserData,
  importUserData,
  clearUserData
} from './storage.js';

const state = {
  exercises: [],
  currentEnv: 'casa',
  deferredInstallPrompt: null
};

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
 * 4. Navegação de Abas do App Shell e Alto Contraste
 */
function setupNavigationAndTheme() {
  const navButtons = document.querySelectorAll('.nav-tab');
  const panels = document.querySelectorAll('.tab-panel');
  const contrastBtn = document.getElementById('contrast-toggle');

  function activateTab(targetId) {
    navButtons.forEach((btn) => {
      const isMatch = btn.dataset.target === targetId;
      btn.classList.toggle('active', isMatch);
      btn.setAttribute('aria-selected', String(isMatch));
    });

    panels.forEach((panel) => {
      panel.classList.toggle('hidden', panel.id !== targetId);
    });
  }

  navButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.target) {
        activateTab(btn.dataset.target);
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
  }

  if (contrastBtn) {
    contrastBtn.addEventListener('click', () => {
      const enabled = document.body.classList.toggle('high-contrast');
      contrastBtn.setAttribute('aria-pressed', String(enabled));
    });
  }
}

/**
 * 5. Carregamento do Catálogo Offline e Renderização dos Cards
 */
async function loadExercisesCatalog() {
  const listEl = document.getElementById('exercises-list');
  const summaryEl = document.getElementById('env-summary');
  const envButtons = document.querySelectorAll('.env-btn');

  try {
    const response = await fetch('./exercises.json');
    const data = await response.json();
    state.exercises = Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn('[PWA] Erro ao carregar exercises.json:', err);
    state.exercises = [];
  }

  function renderExercises() {
    if (!listEl) return;
    const filtered = state.exercises.filter((ex) => ex.ambiente === state.currentEnv);
    const totalMin = filtered.reduce((acc, ex) => acc + (Number(ex.tempo_estimado_min) || 0), 0);

    if (summaryEl) {
      summaryEl.textContent = `${filtered.length} exercícios • ${totalMin} min`;
    }

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <article class="card">
          <p class="card-meta" style="margin:0;">Nenhum exercício listado para este ambiente.</p>
        </article>`;
      return;
    }

    listEl.innerHTML = filtered
      .map((ex, idx) => {
        const indexNum = String(idx + 1).padStart(2, '0');
        return `
      <article class="card" data-exercise-id="${escapeHtml(ex.id)}">
        <div class="card-top">
          <div class="card-index-group">
            <span class="card-index">${indexNum}</span>
            <h3 class="card-title">${escapeHtml(ex.nome_popular)}</h3>
          </div>
          <span class="tag">${escapeHtml(ex.tempo_estimado_min)} MIN</span>
        </div>

        <div class="specs-grid">
          <div class="spec-box">
            <span class="spec-label">Foco Muscular</span>
            <span class="spec-value">${escapeHtml(ex.foco_muscular)}</span>
          </div>
          <div class="spec-box">
            <span class="spec-label">Volume Sugerido</span>
            <span class="spec-value">${escapeHtml(ex.series_recomendadas)}</span>
          </div>
        </div>

        <details class="tech-guide">
          <summary>Guia de execução e adaptação</summary>
          <div class="tech-guide-body">
            <div class="tech-item">
              <strong>Progressão Iniciante</strong>
              <span>${escapeHtml(ex.regressao_segura)}</span>
            </div>
            <div class="tech-item">
              <strong>Alinhamento Articular</strong>
              <span>${escapeHtml(ex.pontos_atencao)}</span>
            </div>
          </div>
        </details>

        <button
          type="button"
          class="btn btn-primary btn-block btn-complete-workout"
          data-id="${escapeHtml(ex.id)}"
          data-nome="${escapeHtml(ex.nome_popular)}"
          data-duracao="${Number(ex.tempo_estimado_min) || 10}"
        >
          <span>Concluir Série</span>
        </button>
      </article>`;
      })
      .join('');

    listEl.querySelectorAll('.btn-complete-workout').forEach((btn) => {
      btn.addEventListener('click', () => {
        const treinoId = btn.getAttribute('data-id') || 'treino-calistenia';
        const nomeExercicio = btn.getAttribute('data-nome') || treinoId;
        const duracaoMin = Number(btn.getAttribute('data-duracao')) || 10;

        const result = saveWorkoutRecord({
          data_iso: new Date().toISOString(),
          treino_id: treinoId,
          duracao_min: duracaoMin,
          exercicios_concluidos: [nomeExercicio]
        });

        if (result.success) {
          btn.classList.add('btn-done');
          btn.innerHTML = '<span>Série Registrada no Histórico</span>';
          setTimeout(() => {
            btn.classList.remove('btn-done');
            btn.innerHTML = '<span>Concluir Série</span>';
          }, 1600);
        }
      });
    });
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

  renderExercises();
}

/**
 * 6. Integração da Aba Histórico e Portabilidade JSON ([PWA-03])
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
