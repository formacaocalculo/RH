// assets/js/modules/registo-horas.js
// ============================================================
//  Registo de horas — modelo append-only com máquina de estados e auditoria.
//
//  Entidades (subcoleções da empresa ativa):
//   - periodosTrabalho/{funcId}  → horário-base esperado por dia da semana.
//   - registosTempo/{id}         → eventos brutos (entrada/saída). IMUTÁVEL.
//                                   Correção = anulação (anulaId) + novo registo
//                                   (correcaoDe). Nunca se edita/apaga.
//   - folhasHoras/{funcId_AAAA-MM} → máquina de estados do período + totais.
//   - auditLog/{id}              → cada operação fica registada. IMUTÁVEL.
//   - eventos/{id}              → HorasAprovadasEvent (handoff p/ Salários). IMUTÁVEL.
//
//  Imutabilidade e "estado só avança" são impostos pelas regras do Firestore.
//  Nota: nesta app os colaboradores não têm login próprio, por isso todas as
//  transições são executadas pelo operador (RH/dono) — a etapa "validado pelo
//  trabalhador" é registada em nome do trabalhador. Cada transição fica no
//  histórico e no auditLog.
// ============================================================

import { getDocs, getDoc, setDoc, addDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { colEmpresa, docEmpresa } from './tenant.js';
import { auth } from '../app.js';
import { renderSidebarHTML, initSidebar } from './sidebar.js';
import { esc } from './html-utils.js';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']; // getDay(): 0=Dom
// Máquina de estados (ordem fixa — usada nas regras via estadoOrdem).
const ESTADOS = ['RASCUNHO', 'SUBMETIDO', 'VALIDADO_PELO_TRABALHADOR', 'APROVADO_RH', 'PROCESSADO_SALARIO'];
const ESTADO_LABEL = {
    RASCUNHO: 'Rascunho', SUBMETIDO: 'Submetido',
    VALIDADO_PELO_TRABALHADOR: 'Validado pelo trabalhador',
    APROVADO_RH: 'Aprovado (RH)', PROCESSADO_SALARIO: 'Processado (salário)',
};
const ESTADO_COR = {
    RASCUNHO: 'var(--rh-text-muted)', SUBMETIDO: 'var(--rh-secondary)',
    VALIDADO_PELO_TRABALHADOR: 'var(--rh-warning)', APROVADO_RH: 'var(--rh-success)',
    PROCESSADO_SALARIO: 'var(--rh-primary)',
};

const hoje = new Date();
let S = {
    funcId: '', ano: hoje.getFullYear(), mes: hoje.getMonth(),
    funcionarios: [], periodo: null, registos: [], folha: null, audit: [], banco: [], func: null,
};

// ─── utilitários ────────────────────────────────────────────────────────────
const min2 = (hhmm) => { const [h, m] = (hhmm || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const horasDe = (r) => Math.max(0, (min2(r.fim) - min2(r.inicio))) / 60;

// Pausa de almoço definida no horário do colaborador (ficha). null se não houver.
function pausaMin() {
    const h = S.func?.horarioTrabalho;
    if (!h || !h.almocoInicio || !h.almocoFim) return null;
    const ini = min2(h.almocoInicio), fim = min2(h.almocoFim);
    return (fim > ini) ? { ini, fim } : null;
}
// Horas da pausa que caem DENTRO de um registo (sobreposição).
function sobrepPausaHoras(r) {
    const p = pausaMin(); if (!p) return 0;
    const ov = Math.min(min2(r.fim), p.fim) - Math.max(min2(r.inicio), p.ini);
    return ov > 0 ? ov / 60 : 0;
}
const fmtH = (h) => h.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + 'h';
const origem = () => (navigator.userAgent || 'web').slice(0, 160);
const quem = () => auth.currentUser?.email || auth.currentUser?.uid || '—';
const periodoId = () => `${S.funcId}_${S.ano}-${String(S.mes + 1).padStart(2, '0')}`;

async function auditar(entidade, refId, acao, detalhe) {
    try {
        await addDoc(colEmpresa('auditLog'), {
            entidade, refId: refId || '', acao, detalhe: detalhe || '',
            por: quem(), em: new Date(), origem: origem(),
        });
    } catch (e) { console.warn('[horas] auditLog falhou:', e); }
}

// Registos "ativos" = entradas de trabalho (têm início/fim) que NÃO foram anuladas.
function registosAtivosDoMes() {
    const pref = `${S.ano}-${String(S.mes + 1).padStart(2, '0')}`;
    const anulados = new Set(S.registos.filter(r => r.anulaId).map(r => r.anulaId));
    return S.registos.filter(r =>
        r.funcId === S.funcId && !r.anulaId && r.inicio && r.fim &&
        (r.data || '').startsWith(pref) && !anulados.has(r.id)
    );
}

// ─── render ───────────────────────────────────────────────────────────────────
export function render() {
    return `
    <div style="display:flex;min-height:100vh;background:var(--rh-bg);font-family:sans-serif;">
        ${renderSidebarHTML('registo-horas')}
        <main style="flex:1;padding:32px;overflow-x:auto;">
            <div style="margin-bottom:20px;">
                <h2 style="margin:0;font-size:24px;color:var(--rh-primary);">⏱️ Registo de Horas</h2>
                <p style="margin:4px 0 0;color:var(--rh-text-muted);font-size:13px;">Registos imutáveis · correções por anulação · fluxo de aprovação</p>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:end;margin-bottom:20px;background:var(--rh-bg-card);padding:14px 16px;border-radius:10px;">
                <div><label style="display:block;font-size:11px;color:var(--rh-text-muted);margin-bottom:3px;">Colaborador</label>
                    <select id="rh-func" style="padding:9px;border:1px solid var(--rh-border);border-radius:6px;min-width:200px;font-size:13px;"></select></div>
                <div><label style="display:block;font-size:11px;color:var(--rh-text-muted);margin-bottom:3px;">Mês</label>
                    <select id="rh-mes" style="padding:9px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;">
                        ${MESES.map((m, i) => `<option value="${i}" ${i === S.mes ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
                <div><label style="display:block;font-size:11px;color:var(--rh-text-muted);margin-bottom:3px;">Ano</label>
                    <input type="number" id="rh-ano" value="${S.ano}" min="2000" max="2100" style="width:90px;padding:9px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;"></div>
                <button onclick="window._rhCarregar()" style="background:var(--rh-primary);color:#fff;border:none;padding:9px 16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:bold;">Ver</button>
            </div>
            <div id="rh-conteudo"><p style="padding:30px;text-align:center;color:var(--rh-text-subtle);font-style:italic;">Escolha um colaborador.</p></div>
        </main>
    </div>`;
}

// ─── carregamento ──────────────────────────────────────────────────────────────
async function carregarFuncionarios() {
    const snap = await getDocs(colEmpresa('funcionarios'));
    S.funcionarios = [];
    snap.forEach(d => S.funcionarios.push({ id: d.id, ...d.data() }));
    S.funcionarios.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt'));
    const sel = document.getElementById('rh-func');
    if (sel) {
        sel.innerHTML = `<option value="">— escolher —</option>` +
            S.funcionarios.map(f => `<option value="${esc(f.id)}" ${f.id === S.funcId ? 'selected' : ''}>${esc(f.nome) || f.id}</option>`).join('');
    }
}

async function carregarDados() {
    // Período de trabalho
    try { const p = await getDoc(docEmpresa('periodosTrabalho', S.funcId)); S.periodo = p.exists() ? p.data() : null; }
    catch (e) { S.periodo = null; }
    // Registos (todos do colaborador; filtramos o mês ao mostrar)
    S.registos = [];
    try { const snap = await getDocs(colEmpresa('registosTempo')); snap.forEach(d => S.registos.push({ id: d.id, ...d.data() })); }
    catch (e) { console.warn('[horas] registos:', e); }
    // Folha do período
    try { const f = await getDoc(docEmpresa('folhasHoras', periodoId())); S.folha = f.exists() ? f.data() : null; }
    catch (e) { S.folha = null; }
    // Auditoria recente
    S.audit = [];
    try { const snap = await getDocs(colEmpresa('auditLog')); snap.forEach(d => S.audit.push({ id: d.id, ...d.data() })); }
    catch (e) { /* opcional */ }
    // Banco de horas (movimentos do colaborador)
    S.banco = [];
    try { const snap = await getDocs(colEmpresa('bancoHoras')); snap.forEach(d => S.banco.push({ id: d.id, ...d.data() })); }
    catch (e) { /* opcional */ }
    // Colaborador atual (para o regime de horas extra)
    S.func = S.funcionarios.find(f => f.id === S.funcId) || null;
}

// ─── cálculo de horas (normais vs suplementares) ────────────────────────────────
function calcular() {
    const ativos = registosAtivosDoMes();
    const porDiaRegs = {};
    ativos.forEach(r => { (porDiaRegs[r.data] = porDiaRegs[r.data] || []).push(r); });
    let normais = 0, extra = 0, defice = 0;
    const detalhe = Object.keys(porDiaRegs).sort().map(data => {
        const regs = porDiaRegs[data];
        let trabalhadas = regs.reduce((s, r) => s + horasDe(r), 0);
        // Opção A: se o dia tiver UM ÚNICO registo que engloba a pausa de almoço,
        // desconta a pausa. Com vários registos, assume-se que a manhã/tarde já
        // foram separadas e não se desconta nada.
        if (regs.length === 1) trabalhadas -= sobrepPausaHoras(regs[0]);
        trabalhadas = Math.max(0, Math.round(trabalhadas * 100) / 100);
        const dow = new Date(data + 'T00:00:00').getDay();
        const esperadas = S.periodo ? (Number(S.periodo.horas?.[dow]) || 0) : 0;
        const n = Math.min(trabalhadas, esperadas || trabalhadas);
        const e = Math.max(0, trabalhadas - (esperadas || trabalhadas));
        const d = (esperadas > 0) ? Math.max(0, esperadas - trabalhadas) : 0;
        normais += n; extra += e; defice += d;
        return { data, dow, trabalhadas, esperadas, normais: n, extra: e, defice: d };
    });
    const r2 = (x) => Math.round(x * 100) / 100;
    const saldoPeriodo = r2(extra - defice);
    return { detalhe, normais: r2(normais), extra: r2(extra), defice: r2(defice), saldoPeriodo, totalDias: Object.keys(porDiaRegs).length };
}

// ─── render do conteúdo ─────────────────────────────────────────────────────────
function renderConteudo() {
    const cont = document.getElementById('rh-conteudo');
    if (!S.funcId) { cont.innerHTML = `<p style="padding:30px;text-align:center;color:var(--rh-text-subtle);font-style:italic;">Escolha um colaborador e carregue em "Ver".</p>`; return; }

    const calc = calcular();
    const estado = S.folha?.estado || 'RASCUNHO';
    const ordem = ESTADOS.indexOf(estado);
    const proximo = ordem < ESTADOS.length - 1 ? ESTADOS[ordem + 1] : null;
    const bloqueado = ordem >= ESTADOS.indexOf('APROVADO_RH'); // após aprovação, não se adicionam registos

    // ── Período de trabalho (horário base) ──
    const horas = (S.periodo?.horas) || {};
    const periodoHTML = `
        <div style="background:var(--rh-bg-card);border-radius:10px;padding:16px;margin-bottom:16px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                <h3 style="margin:0;font-size:15px;color:var(--rh-primary);">Período de Trabalho (horas esperadas/dia)</h3>
                <button onclick="window._rhGuardarPeriodo()" style="background:var(--rh-secondary);color:#fff;border:none;padding:7px 14px;border-radius:6px;cursor:pointer;font-size:12px;">Guardar horário</button>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
                ${[1, 2, 3, 4, 5, 6, 0].map(d => `
                    <div style="text-align:center;">
                        <label style="display:block;font-size:11px;color:var(--rh-text-muted);">${DIAS_SEMANA[d].slice(0, 3)}</label>
                        <input type="number" step="0.5" min="0" max="24" id="rh-h-${d}" value="${horas[d] ?? ''}"
                            style="width:58px;padding:7px;border:1px solid var(--rh-border);border-radius:6px;text-align:center;font-size:13px;">
                    </div>`).join('')}
            </div>
        </div>`;

    // ── Registos do mês ──
    const ativosIds = new Set(registosAtivosDoMes().map(r => r.id));
    const contagemDia = {};
    registosAtivosDoMes().forEach(r => { contagemDia[r.data] = (contagemDia[r.data] || 0) + 1; });
    const anuladosSet = new Set(S.registos.filter(r => r.anulaId).map(r => r.anulaId));
    const pref = `${S.ano}-${String(S.mes + 1).padStart(2, '0')}`;
    const doMes = S.registos
        .filter(r => r.funcId === S.funcId && !r.anulaId && r.inicio && (r.data || '').startsWith(pref))
        .sort((a, b) => (a.data + a.inicio).localeCompare(b.data + b.inicio));

    const registosHTML = `
        <div style="background:var(--rh-bg-card);border-radius:10px;padding:16px;margin-bottom:16px;">
            <h3 style="margin:0 0 10px;font-size:15px;color:var(--rh-primary);">Registos de ${MESES[S.mes]} ${S.ano}</h3>
            ${bloqueado ? '' : `
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-bottom:12px;padding:10px;background:var(--rh-bg-muted);border-radius:8px;">
                <div><label style="display:block;font-size:11px;color:var(--rh-text-muted);">Data</label><input type="date" id="rh-nova-data" style="padding:7px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;"></div>
                <div><label style="display:block;font-size:11px;color:var(--rh-text-muted);">Entrada</label><input type="time" id="rh-nova-inicio" style="padding:7px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;"></div>
                <div><label style="display:block;font-size:11px;color:var(--rh-text-muted);">Saída</label><input type="time" id="rh-nova-fim" style="padding:7px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;"></div>
                <button onclick="window._rhAddRegisto()" style="background:var(--rh-success);color:#fff;border:none;padding:8px 14px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:bold;">+ Registar</button>
            </div>`}
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead><tr style="background:var(--rh-bg-muted);color:var(--rh-text-muted);font-size:11px;text-transform:uppercase;">
                    <th style="padding:8px;text-align:left;">Data</th><th style="padding:8px;">Entrada</th><th style="padding:8px;">Saída</th><th style="padding:8px;">Horas</th><th style="padding:8px;">Estado</th><th style="padding:8px;text-align:right;">Ações</th>
                </tr></thead>
                <tbody>
                    ${doMes.length ? doMes.map(r => {
                        const anulado = anuladosSet.has(r.id);
                        return `<tr style="border-bottom:1px solid var(--rh-border);${anulado ? 'opacity:.5;text-decoration:line-through;' : ''}">
                            <td style="padding:8px;">${esc(r.data)}${r.correcaoDe ? ' <span style="font-size:10px;color:var(--rh-secondary);">(correção)</span>' : ''}</td>
                            <td style="padding:8px;text-align:center;">${esc(r.inicio)}</td>
                            <td style="padding:8px;text-align:center;">${esc(r.fim)}</td>
                            <td style="padding:8px;text-align:center;font-weight:600;">${(() => {
                                const descontaPausa = ativosIds.has(r.id) && contagemDia[r.data] === 1 && sobrepPausaHoras(r) > 0;
                                const liq = descontaPausa ? Math.max(0, horasDe(r) - sobrepPausaHoras(r)) : horasDe(r);
                                return fmtH(liq) + (descontaPausa ? ' <span style="font-size:9px;color:var(--rh-text-subtle);font-weight:400;">(− almoço)</span>' : '');
                            })()}</td>
                            <td style="padding:8px;text-align:center;">${anulado ? '<span style="color:var(--rh-danger);font-size:11px;">anulado</span>' : '<span style="color:var(--rh-success);font-size:11px;">ativo</span>'}</td>
                            <td style="padding:8px;text-align:right;white-space:nowrap;">
                                ${(!anulado && !bloqueado) ? `
                                    <button onclick="window._rhCorrigir('${esc(r.id)}')" title="Corrigir (anula e cria novo)" style="background:none;border:1px solid var(--rh-border);border-radius:5px;padding:4px 8px;cursor:pointer;font-size:11px;">✏️ Corrigir</button>
                                    <button onclick="window._rhAnular('${esc(r.id)}')" title="Anular" style="background:none;border:1px solid var(--rh-border);border-radius:5px;padding:4px 8px;cursor:pointer;font-size:11px;color:var(--rh-danger);">Anular</button>
                                ` : '—'}
                            </td>
                        </tr>`;
                    }).join('') : `<tr><td colspan="6" style="padding:20px;text-align:center;color:var(--rh-text-subtle);font-style:italic;">Sem registos neste mês.</td></tr>`}
                </tbody>
            </table>
        </div>`;

    // ── Totais ──
    const totaisHTML = `
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;">
            ${[['Dias trabalhados', calc.totalDias, 'var(--rh-text)'], ['Horas normais', fmtH(calc.normais), 'var(--rh-primary)'], ['Horas suplementares', fmtH(calc.extra), 'var(--rh-warning)'], ['Horas em défice', fmtH(calc.defice), 'var(--rh-danger)'], ['Saldo do período', (calc.saldoPeriodo >= 0 ? '+' : '−') + fmtH(Math.abs(calc.saldoPeriodo)), calc.saldoPeriodo >= 0 ? 'var(--rh-success)' : 'var(--rh-danger)']]
                .map(([lbl, val, cor]) => `<div style="flex:1;min-width:140px;background:var(--rh-bg-card);border-radius:10px;padding:14px 16px;border-top:3px solid ${cor};">
                    <div style="font-size:11px;color:var(--rh-text-muted);text-transform:uppercase;">${lbl}</div>
                    <div style="font-size:20px;font-weight:bold;color:${cor};">${val}</div></div>`).join('')}
        </div>`;

    // ── Máquina de estados (folha) ──
    const passos = ESTADOS.map((e, i) => {
        const feito = i <= ordem;
        return `<div style="flex:1;text-align:center;">
            <div style="width:26px;height:26px;border-radius:50%;margin:0 auto 4px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;color:#fff;background:${feito ? ESTADO_COR[e] : 'var(--rh-border)'};">${feito ? '✓' : i + 1}</div>
            <div style="font-size:10px;color:${feito ? 'var(--rh-text)' : 'var(--rh-text-subtle)'};">${ESTADO_LABEL[e]}</div>
        </div>`;
    }).join('<div style="flex:0 0 20px;height:2px;background:var(--rh-border);align-self:flex-start;margin-top:13px;"></div>');

    const folhaHTML = `
        <div style="background:var(--rh-bg-card);border-radius:10px;padding:18px;margin-bottom:16px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px;">
                <h3 style="margin:0;font-size:15px;color:var(--rh-primary);">Folha de Horas — fluxo de aprovação</h3>
                <span style="background:${ESTADO_COR[estado]}22;color:${ESTADO_COR[estado]};padding:4px 12px;border-radius:12px;font-size:12px;font-weight:bold;">${ESTADO_LABEL[estado]}</span>
            </div>
            <div style="display:flex;align-items:flex-start;margin-bottom:16px;">${passos}</div>
            ${proximo ? `<button onclick="window._rhAvancar('${proximo}')" style="background:${ESTADO_COR[proximo]};color:#fff;border:none;padding:10px 18px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:bold;">Avançar para: ${ESTADO_LABEL[proximo]} →</button>`
                : '<p style="margin:0;color:var(--rh-success);font-weight:bold;font-size:13px;">✓ Fluxo concluído.</p>'}
            ${ordem >= ESTADOS.indexOf('APROVADO_RH') ? '<p style="margin:10px 0 0;font-size:12px;color:var(--rh-text-muted);">Aprovado — foi emitido um evento <code>HorasAprovadasEvent</code> para o módulo de Salários. Os registos deste período ficam bloqueados.</p>' : ''}
            ${(S.folha?.historico?.length) ? `<div style="margin-top:14px;border-top:1px solid var(--rh-border);padding-top:10px;">
                <div style="font-size:11px;color:var(--rh-text-muted);text-transform:uppercase;margin-bottom:6px;">Histórico de transições</div>
                ${S.folha.historico.map(h => `<div style="font-size:12px;color:var(--rh-text-muted);">${ESTADO_LABEL[h.estado] || h.estado} · ${fmtData(h.em)} · ${esc(h.por)}</div>`).join('')}
            </div>` : ''}
        </div>`;

    // ── Auditoria ──
    const auditMes = S.audit
        .filter(a => (a.refId || '').includes(S.funcId) || a.detalhe?.includes(periodoId()))
        .sort((a, b) => tms(b.em) - tms(a.em)).slice(0, 12);
    const auditHTML = `
        <details style="background:var(--rh-bg-card);border-radius:10px;padding:14px 16px;">
            <summary style="cursor:pointer;font-size:14px;font-weight:bold;color:var(--rh-primary);">🛡️ Registo de auditoria (${auditMes.length})</summary>
            <div style="margin-top:10px;">
                ${auditMes.length ? auditMes.map(a => `<div style="font-size:12px;color:var(--rh-text-muted);border-bottom:1px solid var(--rh-border);padding:5px 0;">
                    <strong>${esc(a.acao)}</strong> · ${fmtData(a.em)} · ${esc(a.por)} ${a.detalhe ? '· ' + esc(a.detalhe) : ''}
                    <span style="display:block;color:var(--rh-text-subtle);font-size:10px;">${esc((a.origem || '').slice(0, 70))}</span>
                </div>`).join('') : '<p style="color:var(--rh-text-subtle);font-style:italic;font-size:12px;">Sem registos.</p>'}
            </div>
        </details>`;

    // ── Banco de horas ──
    const movs = S.banco.filter(m => m.funcId === S.funcId).sort((a, b) => tms(b.em) - tms(a.em));
    const saldo = movs.reduce((s, m) => s + (m.tipo === 'credito' ? 1 : -1) * (Number(m.horas) || 0), 0);
    const tratamento = S.func?.tratamentoHorasExtra || 'pagar';
    const bancoHTML = `
        <div style="background:var(--rh-bg-card);border-radius:10px;padding:18px;margin-bottom:16px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:10px;">
                <h3 style="margin:0;font-size:15px;color:var(--rh-primary);">🏦 Banco de Horas</h3>
                <span style="background:${saldo >= 0 ? 'var(--rh-success-bg)' : 'var(--rh-danger-bg)'};color:${saldo >= 0 ? 'var(--rh-success)' : 'var(--rh-danger-dark)'};padding:5px 14px;border-radius:12px;font-size:15px;font-weight:bold;">Saldo: ${fmtH(saldo)}</span>
            </div>
            <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:end;margin-bottom:14px;">
                <div>
                    <label style="display:block;font-size:11px;color:var(--rh-text-muted);margin-bottom:3px;">Regime das horas extra deste colaborador</label>
                    <select id="rh-tratamento" onchange="window._rhSetTratamento(this.value)" style="padding:8px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;">
                        <option value="pagar" ${tratamento === 'pagar' ? 'selected' : ''}>Pagar no vencimento</option>
                        <option value="banco" ${tratamento === 'banco' ? 'selected' : ''}>Creditar no banco de horas</option>
                    </select>
                    <div style="font-size:10px;color:var(--rh-text-subtle);margin-top:3px;max-width:280px;">No regime "banco", as horas extra aprovadas são creditadas aqui em vez de pagas, e usam-se depois como folgas.</div>
                </div>
                <div style="display:flex;gap:6px;align-items:end;">
                    <div><label style="display:block;font-size:11px;color:var(--rh-text-muted);">Horas</label><input type="number" step="0.5" min="0" id="rh-banco-horas" style="width:90px;padding:8px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;"></div>
                    <div><label style="display:block;font-size:11px;color:var(--rh-text-muted);">Descrição</label><input type="text" id="rh-banco-desc" placeholder="ex.: folga 12/07" style="width:160px;padding:8px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;"></div>
                    <button onclick="window._rhBancoMov('debito')" title="Usar horas (folga)" style="background:var(--rh-warning);color:#fff;border:none;padding:8px 12px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:bold;">− Compensar</button>
                    <button onclick="window._rhBancoMov('credito')" title="Crédito manual" style="background:var(--rh-success);color:#fff;border:none;padding:8px 12px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:bold;">+ Creditar</button>
                </div>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:12px;">
                <thead><tr style="background:var(--rh-bg-muted);color:var(--rh-text-muted);font-size:10px;text-transform:uppercase;">
                    <th style="padding:7px 10px;text-align:left;">Data</th><th style="padding:7px 10px;text-align:left;">Movimento</th><th style="padding:7px 10px;text-align:right;">Horas</th><th style="padding:7px 10px;text-align:left;">Descrição</th><th style="padding:7px 10px;text-align:left;">Por</th>
                </tr></thead>
                <tbody>${movs.length ? movs.map(m => `<tr style="border-top:1px solid var(--rh-border);">
                    <td style="padding:7px 10px;">${fmtData(m.em)}</td>
                    <td style="padding:7px 10px;">${m.tipo === 'credito' ? '<span style="color:var(--rh-success);">＋ crédito</span>' : '<span style="color:var(--rh-warning-text);">－ débito</span>'} <span style="color:var(--rh-text-subtle);font-size:10px;">(${esc(m.categoria || '')})</span></td>
                    <td style="padding:7px 10px;text-align:right;font-weight:600;">${(m.tipo === 'debito' ? '−' : '+')}${fmtH(Number(m.horas) || 0)}</td>
                    <td style="padding:7px 10px;">${esc(m.descricao || '')}</td>
                    <td style="padding:7px 10px;color:var(--rh-text-muted);">${esc(m.por || '')}</td>
                </tr>`).join('') : `<tr><td colspan="5" style="padding:16px;text-align:center;color:var(--rh-text-subtle);font-style:italic;">Sem movimentos.</td></tr>`}</tbody>
            </table>
        </div>`;

    cont.innerHTML = periodoHTML + totaisHTML + registosHTML + folhaHTML + bancoHTML + auditHTML;
}

function tms(d) { try { return d?.toDate ? d.toDate().getTime() : new Date(d).getTime(); } catch { return 0; } }
function fmtData(d) { try { const x = d?.toDate ? d.toDate() : new Date(d); return x.toLocaleString('pt-PT'); } catch { return ''; } }

// ─── ações ──────────────────────────────────────────────────────────────────
async function recarregarEMostrar() { await carregarDados(); renderConteudo(); }

window._rhCarregar = async function() {
    S.funcId = document.getElementById('rh-func').value;
    S.mes = parseInt(document.getElementById('rh-mes').value, 10);
    S.ano = parseInt(document.getElementById('rh-ano').value, 10) || S.ano;
    if (!S.funcId) { renderConteudo(); return; }
    document.getElementById('rh-conteudo').innerHTML = `<p style="padding:30px;text-align:center;color:var(--rh-text-subtle);font-style:italic;">A carregar…</p>`;
    await recarregarEMostrar();
};

window._rhGuardarPeriodo = async function() {
    const horas = {};
    [1, 2, 3, 4, 5, 6, 0].forEach(d => { const v = parseFloat(document.getElementById('rh-h-' + d).value); if (!isNaN(v)) horas[d] = v; });
    try {
        await setDoc(docEmpresa('periodosTrabalho', S.funcId), { funcId: S.funcId, horas, atualizadoEm: new Date(), por: quem() }, { merge: true });
        await auditar('periodoTrabalho', S.funcId, 'GUARDAR_HORARIO', 'Horário base atualizado');
        alert('Horário guardado.');
        await recarregarEMostrar();
    } catch (e) { alert('Erro ao guardar horário: ' + e.message); }
};

window._rhAddRegisto = async function() {
    const data = document.getElementById('rh-nova-data').value;
    const inicio = document.getElementById('rh-nova-inicio').value;
    const fim = document.getElementById('rh-nova-fim').value;
    if (!data || !inicio || !fim) { alert('Preencha data, entrada e saída.'); return; }
    if (min2(fim) <= min2(inicio)) { alert('A saída tem de ser depois da entrada.'); return; }
    try {
        const ref = await addDoc(colEmpresa('registosTempo'), {
            funcId: S.funcId, data, inicio, fim, tipoEntrada: 'manual',
            origem: origem(), criadoPor: quem(), criadoEm: new Date(),
        });
        await auditar('registoTempo', ref.id, 'CRIAR', `${data} ${inicio}-${fim}`);
        await recarregarEMostrar();
    } catch (e) { alert('Erro ao registar: ' + e.message); }
};

// Anular = criar um NOVO registo de anulação que aponta o original (imutável).
window._rhAnular = async function(idOriginal) {
    const motivo = prompt('Motivo da anulação:');
    if (motivo === null) return;
    try {
        await addDoc(colEmpresa('registosTempo'), {
            funcId: S.funcId, anulaId: idOriginal, motivo: motivo || '',
            origem: origem(), criadoPor: quem(), criadoEm: new Date(),
        });
        await auditar('registoTempo', idOriginal, 'ANULAR', motivo || '');
        await recarregarEMostrar();
    } catch (e) { alert('Erro ao anular: ' + e.message); }
};

// Corrigir = anular o original + criar um novo registo de correção.
window._rhCorrigir = async function(idOriginal) {
    const orig = S.registos.find(r => r.id === idOriginal);
    if (!orig) return;
    const inicio = prompt('Nova entrada (HH:MM):', orig.inicio);
    if (inicio === null) return;
    const fim = prompt('Nova saída (HH:MM):', orig.fim);
    if (fim === null) return;
    if (min2(fim) <= min2(inicio)) { alert('A saída tem de ser depois da entrada.'); return; }
    try {
        await addDoc(colEmpresa('registosTempo'), { funcId: S.funcId, anulaId: idOriginal, motivo: 'Correção', origem: origem(), criadoPor: quem(), criadoEm: new Date() });
        const ref = await addDoc(colEmpresa('registosTempo'), {
            funcId: S.funcId, data: orig.data, inicio, fim, tipoEntrada: 'manual',
            correcaoDe: idOriginal, origem: origem(), criadoPor: quem(), criadoEm: new Date(),
        });
        await auditar('registoTempo', ref.id, 'CORRIGIR', `corrige ${idOriginal}: ${inicio}-${fim}`);
        await recarregarEMostrar();
    } catch (e) { alert('Erro ao corrigir: ' + e.message); }
};

// Avançar o estado da folha (a regra impede recuar).
window._rhAvancar = async function(novoEstado) {
    const calc = calcular();
    const ordem = ESTADOS.indexOf(novoEstado);
    if (!confirm(`Avançar a folha de ${S.funcId ? '' : ''}${MESES[S.mes]}/${S.ano} para "${ESTADO_LABEL[novoEstado]}"?`)) return;
    const historico = (S.folha?.historico || []).concat([{ estado: novoEstado, em: new Date(), por: quem(), origem: origem() }]);
    try {
        await setDoc(docEmpresa('folhasHoras', periodoId()), {
            funcId: S.funcId, ano: S.ano, mes: S.mes, estado: novoEstado, estadoOrdem: ordem,
            totais: { normais: calc.normais, extra: calc.extra, defice: calc.defice, saldoPeriodo: calc.saldoPeriodo, dias: calc.totalDias },
            historico, atualizadoEm: new Date(),
        }, { merge: true });
        await auditar('folhaHoras', periodoId(), 'TRANSICAO', novoEstado);

        // Handoff desacoplado para Salários: ao APROVAR, emite um evento imutável.
        if (novoEstado === 'APROVADO_RH') {
            await addDoc(colEmpresa('eventos'), {
                tipo: 'HorasAprovadasEvent', funcId: S.funcId, periodo: `${S.ano}-${String(S.mes + 1).padStart(2, '0')}`,
                payload: { normais: calc.normais, extra: calc.extra, dias: calc.totalDias },
                em: new Date(), por: quem(), origem: origem(),
            });
            await auditar('evento', periodoId(), 'EMITIR_EVENTO', 'HorasAprovadasEvent');

            // Regime "banco": lança no banco o SALDO do período (horas extra menos
            // défice). Positivo → crédito; negativo → débito. As horas extra não
            // são pagas no vencimento (ver processamento.js).
            if ((S.func?.tratamentoHorasExtra || 'pagar') === 'banco' && calc.saldoPeriodo !== 0) {
                const credito = calc.saldoPeriodo > 0;
                await addDoc(colEmpresa('bancoHoras'), {
                    funcId: S.funcId, tipo: credito ? 'credito' : 'debito', horas: Math.abs(calc.saldoPeriodo),
                    categoria: credito ? 'horas_extra' : 'defice',
                    descricao: `${credito ? 'Saldo positivo' : 'Défice'} de ${MESES[S.mes]} ${S.ano} (extra ${calc.extra}h − défice ${calc.defice}h)`,
                    periodo: `${S.ano}-${String(S.mes + 1).padStart(2, '0')}`,
                    em: new Date(), por: quem(), origem: origem(),
                });
                await auditar('bancoHoras', periodoId(), credito ? 'CREDITAR_BANCO' : 'DEBITAR_BANCO', `${calc.saldoPeriodo}h`);
            }
        }
        await recarregarEMostrar();
    } catch (e) { alert('Erro na transição: ' + e.message + '\n(O estado só pode avançar.)'); }
};

// Define o regime das horas extra do colaborador (pagar vs banco).
window._rhSetTratamento = async function(valor) {
    if (!S.funcId) return;
    try {
        await setDoc(docEmpresa('funcionarios', S.funcId), { tratamentoHorasExtra: valor }, { merge: true });
        await auditar('funcionario', S.funcId, 'REGIME_HORAS_EXTRA', valor);
        if (S.func) S.func.tratamentoHorasExtra = valor;
        const idx = S.funcionarios.findIndex(f => f.id === S.funcId);
        if (idx >= 0) S.funcionarios[idx].tratamentoHorasExtra = valor;
    } catch (e) { alert('Erro ao guardar regime: ' + e.message); }
};

// Movimento manual no banco: crédito (ajuste) ou débito (compensação/folga).
window._rhBancoMov = async function(tipo) {
    if (!S.funcId) return;
    const horas = parseFloat(document.getElementById('rh-banco-horas').value);
    const descricao = document.getElementById('rh-banco-desc').value.trim();
    if (isNaN(horas) || horas <= 0) { alert('Indique um número de horas válido.'); return; }
    try {
        await addDoc(colEmpresa('bancoHoras'), {
            funcId: S.funcId, tipo, horas,
            categoria: tipo === 'debito' ? 'compensacao' : 'ajuste',
            descricao, em: new Date(), por: quem(), origem: origem(),
        });
        await auditar('bancoHoras', S.funcId, tipo === 'debito' ? 'DEBITO_BANCO' : 'CREDITO_BANCO', `${horas}h ${descricao}`);
        await recarregarEMostrar();
    } catch (e) { alert('Erro ao registar movimento: ' + e.message); }
};

// ─── init ───────────────────────────────────────────────────────────────────
export async function init() {
    await initSidebar();
    try { await carregarFuncionarios(); }
    catch (e) {
        document.getElementById('rh-conteudo').innerHTML = `<p style="padding:30px;text-align:center;color:var(--rh-danger);">Erro ao carregar colaboradores: ${esc(e.message)}</p>`;
    }
}
