/**
 * @file storage.js
 * @description Gerenciador de Armazenamento Local (LocalStorage) com validação de schema runtime,
 * controle de versão e portabilidade de dados (Export/Import JSON) 100% compatível com a LGPD.
 * Responsável: Dev 1 (Tech Lead & PWA Core) — [PWA-03]
 */

export const STORAGE_KEY = 'fitzero_storage_v1';
export const SCHEMA_VERSION = 1;
export const EXPORT_FILENAME = 'historico-calistenia.json';

function createDefaultStore() {
  return {
    version: SCHEMA_VERSION,
    updated_at: new Date().toISOString(),
    historico: []
  };
}

function isValidIsoDate(value) {
  if (typeof value !== 'string' || value.trim().length < 8) return false;
  const timestamp = Date.parse(value);
  return !Number.isNaN(timestamp);
}

/**
 * Valida e normaliza um item individual de treino concluído conforme o contrato [PWA-03]:
 * { data_iso, treino_id, duracao_min, exercicios_concluidos }
 * @param {unknown} item
 * @returns {{ valid: boolean, record?: Object, error?: string }}
 */
export function validateWorkoutRecord(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return { valid: false, error: 'Registro deve ser um objeto JSON válido.' };
  }

  const data_iso = typeof item.data_iso === 'string' ? item.data_iso.trim() : '';
  if (!isValidIsoDate(data_iso)) {
    return { valid: false, error: 'Campo "data_iso" inválido ou ausente.' };
  }

  const treino_id = typeof item.treino_id === 'string' ? item.treino_id.trim() : '';
  if (!treino_id) {
    return { valid: false, error: 'Campo "treino_id" deve ser uma string não vazia.' };
  }

  const duracaoNum = Number(item.duracao_min);
  if (!Number.isFinite(duracaoNum) || duracaoNum <= 0 || duracaoNum > 600) {
    return { valid: false, error: 'Campo "duracao_min" deve ser um número positivo (1 a 600 min).' };
  }

  let exercicios_concluidos;
  if (Array.isArray(item.exercicios_concluidos)) {
    exercicios_concluidos = item.exercicios_concluidos
      .map((ex) => String(ex).trim())
      .filter(Boolean);
    if (exercicios_concluidos.length === 0) {
      return {
        valid: false,
        error: 'Lista "exercicios_concluidos" deve conter pelo menos 1 exercício.'
      };
    }
  } else if (
    typeof item.exercicios_concluidos === 'number' &&
    Number.isInteger(item.exercicios_concluidos) &&
    item.exercicios_concluidos >= 1
  ) {
    exercicios_concluidos = item.exercicios_concluidos;
  } else {
    return {
      valid: false,
      error: 'Campo "exercicios_concluidos" deve ser um array de exercícios ou inteiro positivo.'
    };
  }

  return {
    valid: true,
    record: {
      data_iso: new Date(data_iso).toISOString(),
      treino_id,
      duracao_min: Math.round(duracaoNum * 10) / 10,
      exercicios_concluidos
    }
  };
}

function getRecordSignature(record) {
  return `${record.data_iso}::${record.treino_id}`;
}

function readStore() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createDefaultStore();
    }

    const parsed = JSON.parse(raw);

    const rawList = Array.isArray(parsed)
      ? parsed
      : parsed && Array.isArray(parsed.historico)
        ? parsed.historico
        : [];

    const validRecords = [];
    for (const item of rawList) {
      const check = validateWorkoutRecord(item);
      if (check.valid && check.record) {
        validRecords.push(check.record);
      }
    }

    return {
      version: SCHEMA_VERSION,
      updated_at:
        parsed && typeof parsed.updated_at === 'string'
          ? parsed.updated_at
          : new Date().toISOString(),
      historico: validRecords
    };
  } catch (err) {
    console.warn('[Storage] Erro ao ler LocalStorage, reiniciando estrutura segura:', err);
    return createDefaultStore();
  }
}

function writeStore(historico) {
  try {
    const payload = {
      version: SCHEMA_VERSION,
      updated_at: new Date().toISOString(),
      historico
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    window.dispatchEvent(
      new CustomEvent('fitzero:history-updated', {
        detail: { total: historico.length, historico }
      })
    );
    return true;
  } catch (err) {
    console.error('[Storage] Falha ao gravar no LocalStorage:', err);
    return false;
  }
}

export function getWorkoutHistory() {
  const store = readStore();
  return [...store.historico].sort(
    (a, b) => Date.parse(b.data_iso) - Date.parse(a.data_iso)
  );
}

export function saveWorkoutRecord(workoutData) {
  const candidate = {
    data_iso:
      workoutData && workoutData.data_iso
        ? workoutData.data_iso
        : new Date().toISOString(),
    ...(workoutData || {})
  };

  const validation = validateWorkoutRecord(candidate);
  if (!validation.valid || !validation.record) {
    return { success: false, error: validation.error };
  }

  const store = readStore();
  const signature = getRecordSignature(validation.record);
  const exists = store.historico.some((item) => getRecordSignature(item) === signature);

  if (!exists) {
    store.historico.push(validation.record);
  }

  const saved = writeStore(store.historico);
  if (!saved) {
    return { success: false, error: 'Não foi possível salvar no armazenamento local do aparelho.' };
  }

  return { success: true, record: validation.record };
}

export function getWorkoutStats() {
  const history = getWorkoutHistory();
  const totalTreinos = history.length;
  const totalMinutos = history.reduce((acc, item) => acc + (Number(item.duracao_min) || 0), 0);
  const diasSet = new Set(history.map((item) => item.data_iso.slice(0, 10)));

  return {
    totalTreinos,
    totalMinutos: Math.round(totalMinutos),
    diasUnicos: diasSet.size
  };
}

export function exportUserData() {
  const historico = getWorkoutHistory();
  const exportPayload = {
    app: 'FitZero',
    schema_version: SCHEMA_VERSION,
    exported_at: new Date().toISOString(),
    historico
  };

  const jsonString = JSON.stringify(exportPayload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = EXPORT_FILENAME;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 150);

  return {
    success: true,
    count: historico.length,
    filename: EXPORT_FILENAME
  };
}

export async function importUserData(jsonFileOrData) {
  try {
    let rawData = jsonFileOrData;

    if (typeof File !== 'undefined' && jsonFileOrData instanceof File) {
      rawData = await jsonFileOrData.text();
    } else if (typeof Blob !== 'undefined' && jsonFileOrData instanceof Blob) {
      rawData = await jsonFileOrData.text();
    }

    const parsed = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;

    const incomingList = Array.isArray(parsed)
      ? parsed
      : parsed && Array.isArray(parsed.historico)
        ? parsed.historico
        : null;

    if (!incomingList) {
      return {
        success: false,
        importedCount: 0,
        skippedCount: 0,
        totalCount: getWorkoutHistory().length,
        error: 'Formato JSON inválido: esperado array "historico" de sessões concluídas.'
      };
    }

    const store = readStore();
    const existingSignatures = new Set(store.historico.map(getRecordSignature));

    let importedCount = 0;
    let skippedCount = 0;
    let firstValidationError = null;

    for (const candidate of incomingList) {
      const check = validateWorkoutRecord(candidate);
      if (!check.valid || !check.record) {
        skippedCount += 1;
        if (!firstValidationError) {
          firstValidationError = check.error;
        }
        continue;
      }

      const sig = getRecordSignature(check.record);
      if (existingSignatures.has(sig)) {
        skippedCount += 1;
        continue;
      }

      store.historico.push(check.record);
      existingSignatures.add(sig);
      importedCount += 1;
    }

    if (incomingList.length > 0 && importedCount === 0 && firstValidationError) {
      return {
        success: false,
        importedCount: 0,
        skippedCount,
        totalCount: store.historico.length,
        error: `Nenhum registro válido encontrado (${firstValidationError})`
      };
    }

    writeStore(store.historico);

    return {
      success: true,
      importedCount,
      skippedCount,
      totalCount: store.historico.length
    };
  } catch (err) {
    return {
      success: false,
      importedCount: 0,
      skippedCount: 0,
      totalCount: getWorkoutHistory().length,
      error: 'Arquivo JSON malformado ou ilegível.'
    };
  }
}

export function clearUserData() {
  return writeStore([]);
}

if (typeof window !== 'undefined') {
  window.FitZeroStorage = {
    STORAGE_KEY,
    SCHEMA_VERSION,
    EXPORT_FILENAME,
    validateWorkoutRecord,
    getWorkoutHistory,
    saveWorkoutRecord,
    getWorkoutStats,
    exportUserData,
    importUserData,
    clearUserData
  };
}
