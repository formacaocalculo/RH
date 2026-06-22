// assets/js/modules/colaborador-utils.js
// Utilitários partilhados entre criar-funcionario.js e ficha-funcionario.js
// para o horário de trabalho e a gestão de filhos/dependentes do colaborador.

import { eliminarComBackup } from './seguranca-dados.js';
import { esc, escAttr } from './html-utils.js';

// ─── Habilitações Literárias / Quadro Nacional de Qualificações (QNQ) ──────
export const NIVEIS_QUALIFICACAO = [
    { valor: 'nivel1', label: 'Nível 1 — 2.º ciclo do Ensino Básico (5.º e 6.º anos)' },
    { valor: 'nivel2', label: 'Nível 2 — 3.º ciclo do Ensino Básico (7.º, 8.º e 9.º anos)' },
    { valor: 'nivel3', label: 'Nível 3 — Ensino Secundário (geral ou prosseguimento de estudos)' },
    { valor: 'nivel4', label: 'Nível 4 — Ensino Secundário (dupla certificação / estágio profissional)' },
    { valor: 'nivel5', label: 'Nível 5 — Qualificação pós-secundária não superior (ex.: CET)' },
    { valor: 'nivel6', label: 'Nível 6 — Licenciatura' },
    { valor: 'nivel7', label: 'Nível 7 — Mestrado' },
    { valor: 'nivel8', label: 'Nível 8 — Doutoramento' },
];

export function labelQualificacao(valor) {
    return NIVEIS_QUALIFICACAO.find(n => n.valor === valor)?.label || null;
}

export function renderSelectQualificacao(id, valorAtual = '') {
    return `
        <select id="${id}" style="width:100%;padding:10px;border:1px solid var(--rh-border);border-radius:6px;box-sizing:border-box;font-size:14px;background:var(--rh-bg-card);">
            <option value="">— Selecionar —</option>
            ${NIVEIS_QUALIFICACAO.map(n => `<option value="${n.valor}" ${n.valor === valorAtual ? 'selected' : ''}>${n.label}</option>`).join('')}
        </select>`;
}

// ─── Estado Civil ────────────────────────────────────────────────────────────
export const ESTADOS_CIVIS = [
    { valor: 'solteiro', label: 'Solteiro(a)' },
    { valor: 'casado', label: 'Casado(a)' },
    { valor: 'uniao_facto', label: 'União de facto' },
    { valor: 'divorciado', label: 'Divorciado(a)' },
    { valor: 'viuvo', label: 'Viúvo(a)' },
    { valor: 'separado_judicialmente', label: 'Separado(a) judicialmente' },
];

export function labelEstadoCivil(valor) {
    return ESTADOS_CIVIS.find(e => e.valor === valor)?.label || null;
}

export function renderSelectEstadoCivil(id, valorAtual = '') {
    return `
        <select id="${id}" style="width:100%;padding:10px;border:1px solid var(--rh-border);border-radius:6px;box-sizing:border-box;font-size:14px;background:var(--rh-bg-card);">
            <option value="">— Selecionar —</option>
            ${ESTADOS_CIVIS.map(e => `<option value="${e.valor}" ${e.valor === valorAtual ? 'selected' : ''}>${e.label}</option>`).join('')}
        </select>`;
}

// ─── Validação de NIB / IBAN ────────────────────────────────────────────────
// Aceita NIB português (21 dígitos) ou IBAN PT (25 chars: PT50 + 21 dígitos)
export function validarNIB(nib) {
    if (!nib) return false;
    const clean = nib.replace(/\s/g, '');
    return /^\d{21}$/.test(clean) || /^PT\d{23}$/.test(clean);
}

// ─── Horário de Trabalho ────────────────────────────────────────────────────
// horario = { entrada, saida, almocoInicio, almocoFim, totalHoras }
// totalHoras é sempre derivado (entrada→saída menos almoço); nunca editado manualmente.

export function calcularTotalHorasHorario(entrada, saida, almocoInicio, almocoFim) {
    if (!entrada || !saida) return 0;

    const paraMinutos = (hhmm) => {
        const [h, m] = hhmm.split(':').map(Number);
        return h * 60 + m;
    };

    let minEntrada = paraMinutos(entrada);
    let minSaida   = paraMinutos(saida);
    if (minSaida <= minEntrada) minSaida += 24 * 60; // turnos que cruzam a meia-noite

    let minAlmoco = 0;
    if (almocoInicio && almocoFim) {
        let minAlmInicio = paraMinutos(almocoInicio);
        let minAlmFim     = paraMinutos(almocoFim);
        if (minAlmFim <= minAlmInicio) minAlmFim += 24 * 60;
        minAlmoco = Math.max(minAlmFim - minAlmInicio, 0);
    }

    const totalMin = (minSaida - minEntrada) - minAlmoco;
    return totalMin > 0 ? Math.round((totalMin / 60) * 100) / 100 : 0;
}

export function formatarHoras(horas) {
    if (!horas || horas <= 0) return '0h';
    const h = Math.floor(horas);
    const m = Math.round((horas - h) * 60);
    return m > 0 ? `${h}h${String(m).padStart(2,'0')}` : `${h}h`;
}

// Renderiza o bloco HTML do horário de trabalho (usado em criar-funcionario e ficha-funcionario)
export function renderHorarioTrabalho(prefix, horario = {}) {
    return `
    <div style="margin-bottom: 14px;">
        <label style="display:block;margin-bottom:5px;font-weight:500;color:var(--rh-text-muted);font-size:13px;">⏰ Horário de Trabalho</label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:8px;">
            <div>
                <label style="display:block;margin-bottom:4px;font-size:11px;color:var(--rh-text-subtle);">Entrada</label>
                <input type="time" id="${prefix}-hor-entrada" value="${horario.entrada || ''}"
                    style="width:100%;padding:9px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;box-sizing:border-box;"
                    oninput="window._colabRecalcularHorario && window._colabRecalcularHorario('${prefix}')">
            </div>
            <div>
                <label style="display:block;margin-bottom:4px;font-size:11px;color:var(--rh-text-subtle);">Saída</label>
                <input type="time" id="${prefix}-hor-saida" value="${horario.saida || ''}"
                    style="width:100%;padding:9px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;box-sizing:border-box;"
                    oninput="window._colabRecalcularHorario && window._colabRecalcularHorario('${prefix}')">
            </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:8px;">
            <div>
                <label style="display:block;margin-bottom:4px;font-size:11px;color:var(--rh-text-subtle);">Pausa Almoço — Início</label>
                <input type="time" id="${prefix}-hor-almoco-inicio" value="${horario.almocoInicio || ''}"
                    style="width:100%;padding:9px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;box-sizing:border-box;"
                    oninput="window._colabRecalcularHorario && window._colabRecalcularHorario('${prefix}')">
            </div>
            <div>
                <label style="display:block;margin-bottom:4px;font-size:11px;color:var(--rh-text-subtle);">Pausa Almoço — Fim</label>
                <input type="time" id="${prefix}-hor-almoco-fim" value="${horario.almocoFim || ''}"
                    style="width:100%;padding:9px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;box-sizing:border-box;"
                    oninput="window._colabRecalcularHorario && window._colabRecalcularHorario('${prefix}')">
            </div>
        </div>
        <div style="background:var(--rh-success-bg);border:1px solid var(--rh-success-bg);border-radius:6px;padding:8px 12px;font-size:12px;color:var(--rh-success-text);">
            Total de horas de trabalho/dia: <strong id="${prefix}-hor-total">${formatarHoras(horario.totalHoras || 0)}</strong>
        </div>
    </div>`;
}

export function lerHorarioTrabalhoDoForm(prefix) {
    const entrada       = document.getElementById(`${prefix}-hor-entrada`)?.value || '';
    const saida         = document.getElementById(`${prefix}-hor-saida`)?.value || '';
    const almocoInicio  = document.getElementById(`${prefix}-hor-almoco-inicio`)?.value || '';
    const almocoFim     = document.getElementById(`${prefix}-hor-almoco-fim`)?.value || '';
    const totalHoras    = calcularTotalHorasHorario(entrada, saida, almocoInicio, almocoFim);
    return { entrada, saida, almocoInicio, almocoFim, totalHoras };
}

// Recalcula e atualiza o total de horas exibido sempre que um campo do horário muda
window._colabRecalcularHorario = function(prefix) {
    const h = lerHorarioTrabalhoDoForm(prefix);
    const el = document.getElementById(`${prefix}-hor-total`);
    if (el) el.textContent = formatarHoras(h.totalHoras);
};

// ─── Filhos / Dependentes ───────────────────────────────────────────────────
// filho = { id, nascimento: 'YYYY-MM-DD', grauIncapacidade: number|null }

export function calcularIdade(dataNascimento, referencia = new Date()) {
    if (!dataNascimento) return null;
    const nasc = new Date(dataNascimento + 'T00:00:00');
    let idade = referencia.getFullYear() - nasc.getFullYear();
    const aindaNaoFezAniversario =
        referencia.getMonth() < nasc.getMonth() ||
        (referencia.getMonth() === nasc.getMonth() && referencia.getDate() < nasc.getDate());
    if (aindaNaoFezAniversario) idade--;
    return Math.max(idade, 0);
}

let _filhosCounter = 0;
export function novoFilhoId() {
    return `filho_${Date.now()}_${_filhosCounter++}`;
}

// Renderiza o bloco completo de gestão de filhos (contador + lista dinâmica)
export function renderFilhosSection(prefix) {
    return `
    <div style="margin-bottom: 14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <label style="font-weight:500;color:var(--rh-text-muted);font-size:13px;">👶 Número de Filhos</label>
            <button type="button" onclick="window._colabAddFilho('${prefix}')"
                style="background:var(--rh-primary-soft);color:var(--rh-primary);border:1px solid var(--rh-primary-light);border-radius:6px;padding:5px 12px;cursor:pointer;font-size:12px;font-weight:bold;">
                + Adicionar Filho
            </button>
        </div>
        <div id="${prefix}-filhos-lista" style="display:flex;flex-direction:column;gap:8px;"></div>
        <small style="color:var(--rh-text-subtle);font-size:11px;display:block;margin-top:6px;">
            A idade de cada filho é calculada automaticamente a partir da data de nascimento.
            Preencha o grau de incapacidade apenas se aplicável.
        </small>
    </div>`;
}

function _filhoLinhaHTML(prefix, filho) {
    const idade = calcularIdade(filho.nascimento);
    const idadeTxt = idade === null ? '—' : `${idade} ano${idade === 1 ? '' : 's'}`;
    return `
    <div class="filho-linha" data-filho-id="${escAttr(filho.id)}"
         style="display:flex;flex-wrap:wrap;gap:8px;align-items:end;background:var(--rh-bg-muted);border:1px solid var(--rh-border);border-radius:6px;padding:10px;">
        <div style="flex:1 1 100%;">
            <label style="display:block;margin-bottom:3px;font-size:11px;color:var(--rh-text-subtle);">Data de Nascimento</label>
            <input type="date" class="filho-nascimento" value="${esc(filho.nascimento)}"
                style="width:100%;padding:7px;border:1px solid var(--rh-border);border-radius:5px;font-size:12px;box-sizing:border-box;"
                onchange="window._colabUpdateFilho('${prefix}','${escAttr(filho.id)}')">
        </div>
        <div style="flex:1 1 70px;">
            <label style="display:block;margin-bottom:3px;font-size:11px;color:var(--rh-text-subtle);">Idade</label>
            <div class="filho-idade" style="padding:7px 0;font-size:13px;font-weight:bold;color:var(--rh-primary);white-space:nowrap;">${idadeTxt}</div>
        </div>
        <div style="flex:1 1 90px;">
            <label style="display:block;margin-bottom:3px;font-size:11px;color:var(--rh-text-subtle);">Grau Incap. (%)</label>
            <input type="number" class="filho-incapacidade" min="0" max="100" placeholder="—" value="${esc(filho.grauIncapacidade ?? '')}"
                style="width:100%;padding:7px;border:1px solid var(--rh-border);border-radius:5px;font-size:12px;box-sizing:border-box;"
                onchange="window._colabUpdateFilho('${prefix}','${escAttr(filho.id)}')">
        </div>
        <button type="button" onclick="window._colabRemoveFilho('${prefix}','${escAttr(filho.id)}')"
            style="background:none;border:none;color:var(--rh-danger);cursor:pointer;font-size:16px;padding:7px 4px;flex:0 0 auto;" title="Remover">✕</button>
    </div>`;
}

// Estado dos filhos por prefixo (permite usar o mesmo módulo em criar-funcionario e ficha-funcionario)
const _filhosState = {};
const _contextoFunc = {}; // { [prefix]: { funcId, nomeFunc } } — necessário para o backup ao eliminar

export function definirContextoFuncionario(prefix, funcId, nomeFunc) {
    _contextoFunc[prefix] = { funcId, nomeFunc };
}

export function inicializarFilhosState(prefix, filhosIniciais = []) {
    _filhosState[prefix] = filhosIniciais.map(f => ({
        id: f.id || novoFilhoId(),
        nascimento: f.nascimento || '',
        grauIncapacidade: f.grauIncapacidade ?? null,
        _persistido: true, // já existia gravado no Firestore antes desta sessão de edição
    }));
    _renderFilhosLista(prefix);
}

export function obterFilhosState(prefix) {
    return (_filhosState[prefix] || []).map(f => ({
        id: f.id,
        nascimento: f.nascimento || null,
        idade: calcularIdade(f.nascimento),
        grauIncapacidade: f.grauIncapacidade ?? null,
    }));
}

function _renderFilhosLista(prefix) {
    const cont = document.getElementById(`${prefix}-filhos-lista`);
    if (!cont) return;
    const filhos = _filhosState[prefix] || [];
    cont.innerHTML = filhos.length
        ? filhos.map(f => _filhoLinhaHTML(prefix, f)).join('')
        : `<p style="color:var(--rh-text-subtle);font-style:italic;font-size:12px;margin:0;">Nenhum filho registado.</p>`;
}

window._colabAddFilho = function(prefix) {
    if (!_filhosState[prefix]) _filhosState[prefix] = [];
    _filhosState[prefix].push({ id: novoFilhoId(), nascimento: '', grauIncapacidade: null });
    _renderFilhosLista(prefix);
};

window._colabRemoveFilho = async function(prefix, filhoId) {
    if (!_filhosState[prefix]) return;
    const filho = _filhosState[prefix].find(f => f.id === filhoId);
    if (!filho) return;

    if (filho._persistido) {
        // Filho já gravado no Firestore: exige reautenticação e cria backup antes de remover.
        const ctx = _contextoFunc[prefix] || {};
        const ok = await eliminarComBackup({
            colecao: 'funcionarios',
            docId: ctx.funcId || prefix,
            dados: { id: filho.id, nascimento: filho.nascimento, grauIncapacidade: filho.grauIncapacidade },
            tipo: 'filho',
            descricao: `Filho de ${ctx.nomeFunc || ctx.funcId || prefix} (nascido ${filho.nascimento || '—'})`,
            subcampo: { campo: 'filhos' },
            mensagemConfirmacao: 'Este filho/dependente será removido da ficha do colaborador e fica guardado na lixeira. Introduza a sua password para confirmar.',
            onUpdateDoc: async () => {
                // A remoção real do array "filhos" só é persistida quando o utilizador
                // clicar em "Guardar Filhos" — aqui apenas confirmamos a intenção e
                // registamos o backup; a remoção do estado local ocorre a seguir.
            },
        });
        if (!ok) return;
    }

    _filhosState[prefix] = _filhosState[prefix].filter(f => f.id !== filhoId);
    _renderFilhosLista(prefix);
};

window._colabUpdateFilho = function(prefix, filhoId) {
    const linha = document.querySelector(`.filho-linha[data-filho-id="${filhoId}"]`);
    const filho = (_filhosState[prefix] || []).find(f => f.id === filhoId);
    if (!linha || !filho) return;
    filho.nascimento = linha.querySelector('.filho-nascimento').value || '';
    const incap = linha.querySelector('.filho-incapacidade').value;
    filho.grauIncapacidade = incap === '' ? null : Math.min(Math.max(parseInt(incap) || 0, 0), 100);
    // Atualiza apenas a idade exibida, sem re-renderizar a linha toda (preserva foco)
    const idadeEl = linha.querySelector('.filho-idade');
    const idade = calcularIdade(filho.nascimento);
    idadeEl.textContent = idade === null ? '—' : `${idade} ano${idade === 1 ? '' : 's'}`;
};
