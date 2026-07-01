// assets/js/modules/processamento.js
// Processa o vencimento mensal de todos os colaboradores ativos da empresa:
//   - Vencimento base (proporcional a faltas que descontam, se aplicável)
//   - Subsídio de refeição (reaproveitando as mesmas regras de assiduidade.js)
//   - Desconto de Segurança Social (taxa definida na Parametrização)
//   - Retenção de IRS (taxa manual definida na ficha de cada colaborador)
//   - Vencimento líquido
//
// Cada processamento é gravado em colEmpresa('processamentos') com um id
// único por mês/ano, e cada colaborador processado fica como uma linha
// dentro do campo "linhas" desse documento — para depois ser consultado e
// transformado em recibo individual (ver recibos.js).

import { getDocs, getDoc, setDoc, query, where } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { colEmpresa, docEmpresa, empresaAtiva } from './tenant.js';
import { renderSidebarHTML, initSidebar } from './sidebar.js';
import { TIPOS_LABEL, contaComoFaltaAss, usaHora, contarUnidades } from './assiduidade.js';
import { esc, escAttr } from './html-utils.js';

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

let S = {
    ano: new Date().getFullYear(),
    mes: new Date().getMonth(),
    funcionarios: [],
    parametros: { subsidioRefeicao: 0, horasMinSubsidio: 0, taxaSSTrabalhador: 11, taxaSSEntidade: 23.75, horasMensais: 176, multiplicadorHoraExtra: 1.25 },
    linhasCalculadas: [],
};

// ─── render() ───────────────────────────────────────────────────────────────
export function render() {
    return `
    <div style="display:flex;min-height:100vh;background:var(--rh-bg);font-family:sans-serif;">
        ${renderSidebarHTML('processamento')}
        <main style="flex:1;padding:30px;overflow-y:auto;">
            <header style="display:flex;justify-content:space-between;align-items:center;margin-bottom:22px;flex-wrap:wrap;gap:10px;">
                <div>
                    <h2 style="margin:0;font-size:24px;color:var(--rh-primary);">💶 Processamento de Vencimentos</h2>
                    <p style="margin:4px 0 0;font-size:13px;color:var(--rh-text-muted);">Calcule e confirme o vencimento mensal de todos os colaboradores ativos.</p>
                </div>
                <div style="display:flex;gap:8px;align-items:center;">
                    <select id="proc-mes" style="padding:9px 12px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;background:var(--rh-bg-card);">
                        ${MESES.map((m, i) => `<option value="${i}">${m}</option>`).join('')}
                    </select>
                    <input type="number" id="proc-ano" min="2000" max="2100" style="width:90px;padding:9px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;">
                    <button onclick="window._procCalcular()"
                        style="background:var(--rh-primary);color:#fff;border:none;padding:10px 18px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:bold;">
                        🔄 Calcular
                    </button>
                </div>
            </header>

            <div id="proc-status" style="margin-bottom:16px;"></div>

            <div id="proc-resumo" style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px;"></div>

            <div style="background:var(--rh-bg-card);border-radius:12px;box-shadow:0 2px 4px rgba(0,0,0,0.04);overflow:hidden;">
                <table style="width:100%;border-collapse:collapse;font-size:13px;">
                    <thead>
                        <tr style="background:var(--rh-bg-muted);color:var(--rh-text-subtle);text-transform:uppercase;font-size:11px;border-bottom:2px solid var(--rh-border);">
                            <th style="padding:12px 16px;text-align:left;">Colaborador</th>
                            <th style="padding:12px 16px;text-align:right;">Vencimento Base</th>
                            <th style="padding:12px 16px;text-align:right;">Horas Extra</th>
                            <th style="padding:12px 16px;text-align:right;">Sub. Refeição</th>
                            <th style="padding:12px 16px;text-align:right;">Desc. SS</th>
                            <th style="padding:12px 16px;text-align:right;">Ret. IRS</th>
                            <th style="padding:12px 16px;text-align:right;">Líquido</th>
                            <th style="padding:12px 16px;text-align:center;">Faltas Desc.</th>
                        </tr>
                    </thead>
                    <tbody id="proc-tbody">
                        <tr><td colspan="7" style="text-align:center;padding:40px;color:var(--rh-text-subtle);font-style:italic;">
                            Escolha o mês/ano e clique em "Calcular".
                        </td></tr>
                    </tbody>
                </table>
            </div>

            <div style="margin-top:18px;display:flex;justify-content:flex-end;gap:10px;">
                <button onclick="window._procConfirmar()"
                    style="background:var(--rh-accent);color:var(--rh-text);border:none;padding:11px 22px;border-radius:6px;cursor:pointer;font-size:14px;font-weight:bold;">
                    ✔ Confirmar e Guardar Processamento
                </button>
            </div>
        </main>
    </div>`;
}

// ─── Cálculo de dias úteis e faltas do mês ─────────────────────────────────
function diasUteisDoMes(ano, mes) {
    const total = new Date(ano, mes + 1, 0).getDate();
    let uteis = 0;
    for (let d = 1; d <= total; d++) {
        const wd = new Date(ano, mes, d).getDay();
        if (wd !== 0 && wd !== 6) uteis++;
    }
    return uteis;
}

// Dias úteis do mês em que o colaborador esteve EFETIVAMENTE ao serviço,
// considerando a data de admissão e a data de cessação (mês incompleto).
function diasUteisAtivosDoMes(ano, mes, admissaoStr, cessacaoStr) {
    const total = new Date(ano, mes + 1, 0).getDate();
    const adm = admissaoStr ? new Date(admissaoStr + 'T00:00:00') : null;
    const ces = cessacaoStr ? new Date(cessacaoStr + 'T00:00:00') : null;
    let uteis = 0;
    for (let d = 1; d <= total; d++) {
        const dt = new Date(ano, mes, d);
        const wd = dt.getDay();
        if (wd === 0 || wd === 6) continue;
        if (adm && dt < adm) continue;   // antes da admissão
        if (ces && dt > ces) continue;   // depois da cessação
        uteis++;
    }
    return uteis;
}

function calcularFaltasDoMes(ausencias, ano, mes) {
    const prefixoMes = `${ano}-${String(mes + 1).padStart(2, '0')}`;
    const fimMes = new Date(ano, mes + 1, 0);
    const fimMesStr = fimMes.toISOString().slice(0, 10);
    let diasDesconto = 0;
    const diasComFaltaParcial = new Set();

    ausencias.forEach(a => {
        const def = TIPOS_LABEL[a.tipo];
        if (!def) return;
        const tocaNoMes = a.dataInicio.startsWith(prefixoMes) || a.dataFim.startsWith(prefixoMes) ||
            (a.dataInicio < prefixoMes + '-01' && a.dataFim >= prefixoMes + '-01');
        if (!tocaNoMes) return;

        if (usaHora(a.tipo)) {
            if (a.dataInicio.startsWith(prefixoMes)) diasComFaltaParcial.add(a.dataInicio);
        } else if (contaComoFaltaAss(a.tipo)) {
            const inicioEfetivo = a.dataInicio < prefixoMes + '-01' ? prefixoMes + '-01' : a.dataInicio;
            const fimEfetivo = a.dataFim > fimMesStr ? fimMesStr : a.dataFim;
            let d = new Date(inicioEfetivo + 'T00:00:00');
            const fim = new Date(fimEfetivo + 'T00:00:00');
            while (d <= fim) {
                const wd = d.getDay();
                if (wd !== 0 && wd !== 6) diasDesconto++;
                d.setDate(d.getDate() + 1);
            }
        }
    });

    return { diasDesconto, diasComFaltaParcial };
}

function diasSemSubsidioPorFaltaParcial(func, ausencias, diasComFaltaParcial) {
    const horasPrevistas = func.horarioTrabalho?.totalHoras || 0;
    if (!horasPrevistas) return 0;
    let semSubsidio = 0;
    diasComFaltaParcial.forEach(ds => {
        let horasAusencia = 0;
        ausencias.forEach(a => {
            if (usaHora(a.tipo) && a.dataInicio <= ds && ds <= a.dataFim) {
                horasAusencia += contarUnidades(a, 'hora');
            }
        });
        const trabalhadas = Math.max(horasPrevistas - horasAusencia, 0);
        if (trabalhadas < (S.parametros.horasMinSubsidio || 0)) semSubsidio++;
    });
    return semSubsidio;
}

// Dias úteis de férias do colaborador dentro do mês (não recebem subsídio de
// refeição). As férias estão no calendário do colaborador (diasFerias/diasGozados),
// não nas ausências.
function diasUteisFeriasNoMes(func, ano, mes) {
    const set = new Set([...(func.diasFerias || []), ...(func.diasGozados || [])]);
    const pref = `${ano}-${String(mes + 1).padStart(2, '0')}`;
    let n = 0;
    set.forEach(ds => {
        if (!ds || !ds.startsWith(pref)) return;
        if (func.admissao && ds < func.admissao) return;
        if (func.dataCessacao && ds > func.dataCessacao) return;
        const wd = new Date(ds + 'T00:00:00').getDay();
        if (wd === 0 || wd === 6) return; // só dias úteis
        n++;
    });
    return n;
}

// ─── Cálculo do processamento ───────────────────────────────────────────────
async function calcularLinha(func, ano, mes, diasUteisMes) {
    let ausencias = [];
    try {
        const snap = await getDoc(docEmpresa('ausencias', func.id));
        if (snap.exists()) ausencias = snap.data().ausencias || [];
    } catch (e) { /* sem ausências */ }

    const { diasDesconto, diasComFaltaParcial } = calcularFaltasDoMes(ausencias, ano, mes);
    const semSubsidioParcial = diasSemSubsidioPorFaltaParcial(func, ausencias, diasComFaltaParcial);

    const salarioBase = func.salarioBase || 0;
    // Dias úteis em que esteve ao serviço (trata admissão/cessação a meio do mês).
    const diasUteisAtivos = diasUteisAtivosDoMes(ano, mes, func.admissao, func.dataCessacao);
    const proporcao = diasUteisMes > 0 ? Math.max(diasUteisAtivos - diasDesconto, 0) / diasUteisMes : 1;
    const vencimentoBase = Math.round(salarioBase * proporcao * 100) / 100;

    // Dias de férias do mês não recebem subsídio de refeição.
    const diasFeriasMes = diasUteisFeriasNoMes(func, ano, mes);
    const diasComSubsidio = Math.max(diasUteisAtivos - diasDesconto - semSubsidioParcial - diasFeriasMes, 0);
    // Subsídio de refeição: valor/dia por colaborador (func.subsidioRefeicaoDia)
    // com recuo ao valor da empresa (Parametrização).
    const valorSubDia = (func.subsidioRefeicaoDia !== undefined && func.subsidioRefeicaoDia !== null && func.subsidioRefeicaoDia !== '')
        ? Number(func.subsidioRefeicaoDia)
        : (S.parametros.subsidioRefeicao || 0);
    const subsidioRefeicao = Math.round(diasComSubsidio * valorSubDia * 100) / 100;
    // Pago em cartão? Nesse caso aparece no recibo mas NÃO entra no líquido em
    // dinheiro (é carregado no cartão à parte).
    const subsidioEmCartao = func.subsidioRefeicaoModo === 'cartao';

    // Horas suplementares: só as APROVADAS na folha de horas deste período entram
    // no vencimento (respeita o fluxo RASCUNHO→…→APROVADO_RH do Registo de Horas).
    // Exceção: se o colaborador estiver em regime de BANCO DE HORAS, as horas
    // extra são creditadas no banco e NÃO são pagas aqui.
    let horasExtra = 0;
    if ((func.tratamentoHorasExtra || 'pagar') !== 'banco') {
        try {
            const fId = `${func.id}_${ano}-${String(mes + 1).padStart(2, '0')}`;
            const fSnap = await getDoc(docEmpresa('folhasHoras', fId));
            if (fSnap.exists()) {
                const fd = fSnap.data();
                if (fd.estado === 'APROVADO_RH' || fd.estado === 'PROCESSADO_SALARIO') {
                    horasExtra = Number(fd.totais?.extra) || 0;
                }
            }
        } catch (e) { /* sem folha de horas */ }
    }

    const horasMensais = S.parametros.horasMensais || 176;
    const valorHora = horasMensais > 0 ? salarioBase / horasMensais : 0;
    const valorHorasExtra = Math.round(horasExtra * valorHora * (S.parametros.multiplicadorHoraExtra || 1) * 100) / 100;

    // Horas extra estão sujeitas a SS e IRS (entram na base de incidência);
    // o subsídio de refeição não entra (como já era).
    const baseIncidencia = vencimentoBase + valorHorasExtra;
    const descontoSS = Math.round(baseIncidencia * (S.parametros.taxaSSTrabalhador || 0) / 100 * 100) / 100;
    const taxaIRS = func.taxaIRS || 0;
    const retencaoIRS = Math.round(baseIncidencia * taxaIRS / 100 * 100) / 100;

    const liquido = Math.round((vencimentoBase + valorHorasExtra + (subsidioEmCartao ? 0 : subsidioRefeicao) - descontoSS - retencaoIRS) * 100) / 100;

    return {
        funcId: func.id,
        nome: func.nome,
        nif: func.nif || '',
        cargo: func.cargo || '',
        salarioBase,
        diasUteisMes,
        diasUteisAtivos,
        diasDesconto,
        diasFeriasMes,
        diasComSubsidio,
        vencimentoBase,
        horasExtra,
        valorHora: Math.round(valorHora * 100) / 100,
        valorHorasExtra,
        subsidioRefeicao,
        subsidioModo: subsidioEmCartao ? 'cartao' : 'dinheiro',
        subsidioEmCartao,
        descontoSS,
        taxaSSTrabalhador: S.parametros.taxaSSTrabalhador,
        retencaoIRS,
        taxaIRS,
        liquido,
    };
}

// ─── Ações ────────────────────────────────────────────────────────────────────
window._procCalcular = async function() {
    const status = document.getElementById('proc-status');
    status.innerHTML = `<p style="color:var(--rh-text-subtle);font-style:italic;">A calcular…</p>`;

    S.ano = parseInt(document.getElementById('proc-ano').value) || S.ano;
    S.mes = parseInt(document.getElementById('proc-mes').value);

    const diasUteisMes = diasUteisDoMes(S.ano, S.mes);
    const mm = String(S.mes + 1).padStart(2, '0');
    const inicioMes = `${S.ano}-${mm}-01`;
    const fimMes = `${S.ano}-${mm}-${String(new Date(S.ano, S.mes + 1, 0).getDate()).padStart(2, '0')}`;
    // Elegíveis para este mês: admitidos até ao fim do mês e, se já cessaram,
    // só até ao mês da cessação (inclusive). Ativos sem cessação entram sempre.
    const elegiveis = S.funcionarios.filter(f => {
        if (f.admissao && f.admissao > fimMes) return false;
        if (f.dataCessacao) return f.dataCessacao >= inicioMes;
        return f.ativo !== false;
    });
    const linhas = [];
    for (const func of elegiveis) {
        linhas.push(await calcularLinha(func, S.ano, S.mes, diasUteisMes));
    }
    S.linhasCalculadas = linhas;

    renderResumo(linhas);
    renderTabela(linhas);
    status.innerHTML = `<p style="color:var(--rh-success-text);background:var(--rh-success-bg);border:1px solid var(--rh-success);border-radius:6px;padding:8px 12px;font-size:12px;display:inline-block;">
        ✔ Cálculo concluído para ${MESES[S.mes]} de ${S.ano} · ${linhas.length} colaborador(es)
    </p>`;
};

function renderResumo(linhas) {
    const totalBruto = linhas.reduce((s, l) => s + l.vencimentoBase + (l.valorHorasExtra || 0) + l.subsidioRefeicao, 0);
    const totalSS = linhas.reduce((s, l) => s + l.descontoSS, 0);
    const totalIRS = linhas.reduce((s, l) => s + l.retencaoIRS, 0);
    const totalLiquido = linhas.reduce((s, l) => s + l.liquido, 0);
    const fmt = (v) => v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });

    document.getElementById('proc-resumo').innerHTML = `
        <div style="background:var(--rh-bg-card);padding:18px;border-radius:10px;border-top:4px solid var(--rh-primary);">
            <small style="color:var(--rh-text-muted);text-transform:uppercase;font-size:11px;font-weight:bold;">Total Bruto + Subsídios</small>
            <h3 style="margin:8px 0 0;font-size:22px;color:var(--rh-primary);">${fmt(totalBruto)}</h3>
        </div>
        <div style="background:var(--rh-bg-card);padding:18px;border-radius:10px;border-top:4px solid var(--rh-warning);">
            <small style="color:var(--rh-text-muted);text-transform:uppercase;font-size:11px;font-weight:bold;">Total Desconto SS</small>
            <h3 style="margin:8px 0 0;font-size:22px;color:var(--rh-primary);">${fmt(totalSS)}</h3>
        </div>
        <div style="background:var(--rh-bg-card);padding:18px;border-radius:10px;border-top:4px solid var(--rh-danger);">
            <small style="color:var(--rh-text-muted);text-transform:uppercase;font-size:11px;font-weight:bold;">Total Retenção IRS</small>
            <h3 style="margin:8px 0 0;font-size:22px;color:var(--rh-primary);">${fmt(totalIRS)}</h3>
        </div>
        <div style="background:var(--rh-bg-card);padding:18px;border-radius:10px;border-top:4px solid var(--rh-secondary);">
            <small style="color:var(--rh-text-muted);text-transform:uppercase;font-size:11px;font-weight:bold;">Total Líquido a Pagar</small>
            <h3 style="margin:8px 0 0;font-size:22px;color:var(--rh-primary);">${fmt(totalLiquido)}</h3>
        </div>`;
}

function renderTabela(linhas) {
    const tbody = document.getElementById('proc-tbody');
    if (!linhas.length) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--rh-text-subtle);font-style:italic;">Nenhum colaborador ativo encontrado.</td></tr>`;
        return;
    }
    const fmt = (v) => v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
    tbody.innerHTML = linhas.map((l, i) => `
        <tr style="border-bottom:1px solid var(--rh-border);background:${i % 2 === 0 ? 'var(--rh-bg-card)' : 'var(--rh-bg-muted)'};">
            <td style="padding:11px 16px;font-weight:500;color:var(--rh-primary-dark);">${esc(l.nome)}</td>
            <td style="padding:11px 16px;text-align:right;">${fmt(l.vencimentoBase)}</td>
            <td style="padding:11px 16px;text-align:right;color:var(--rh-warning-text);">${l.valorHorasExtra > 0 ? fmt(l.valorHorasExtra) + ` <span style="font-size:10px;color:var(--rh-text-subtle);">(${l.horasExtra}h)</span>` : '—'}</td>
            <td style="padding:11px 16px;text-align:right;color:var(--rh-secondary);">${fmt(l.subsidioRefeicao)}</td>
            <td style="padding:11px 16px;text-align:right;color:var(--rh-warning);">−${fmt(l.descontoSS)}</td>
            <td style="padding:11px 16px;text-align:right;color:var(--rh-danger);">−${fmt(l.retencaoIRS)}</td>
            <td style="padding:11px 16px;text-align:right;font-weight:bold;color:var(--rh-primary);">${fmt(l.liquido)}</td>
            <td style="padding:11px 16px;text-align:center;">${l.diasDesconto > 0 ? `<span style="background:var(--rh-danger-bg);color:var(--rh-danger-text);padding:2px 9px;border-radius:10px;font-size:11px;font-weight:bold;">${l.diasDesconto}</span>` : '<span style="color:var(--rh-border);">—</span>'}</td>
        </tr>`).join('');
}

window._procConfirmar = async function() {
    if (!S.linhasCalculadas || !S.linhasCalculadas.length) {
        alert('Calcule o processamento antes de confirmar.');
        return;
    }
    if (!confirm(`Confirmar o processamento de ${MESES[S.mes]} de ${S.ano} para ${S.linhasCalculadas.length} colaborador(es)?\n\nIsto fica registado e disponível para gerar recibos.`)) return;

    const id = `${S.ano}-${String(S.mes + 1).padStart(2, '0')}`;
    try {
        await setDoc(docEmpresa('processamentos', id), {
            ano: S.ano,
            mes: S.mes,
            linhas: S.linhasCalculadas,
            processadoEm: new Date().toISOString(),
        });
        alert('Processamento guardado com sucesso. Já pode consultar os recibos em "Recibos".');
    } catch (e) {
        alert('Erro ao guardar processamento: ' + e.message);
    }
};

// ─── init() ───────────────────────────────────────────────────────────────────
export async function init() {
    await initSidebar();

    document.getElementById('proc-mes').value = S.mes;
    document.getElementById('proc-ano').value = S.ano;

    try {
        const ps = await getDoc(docEmpresa('configuracoes', 'empresa_base'));
        if (ps.exists()) {
            const pd = ps.data();
            S.parametros.subsidioRefeicao = pd.subsidioRefeicao || 0;
            S.parametros.horasMinSubsidio = pd.horasMinSubsidio || 0;
            S.parametros.taxaSSTrabalhador = pd.taxaSSTrabalhador ?? 11;
            S.parametros.taxaSSEntidade = pd.taxaSSEntidade ?? 23.75;
            S.parametros.horasMensais = pd.horasMensais || 176;
            S.parametros.multiplicadorHoraExtra = pd.multiplicadorHoraExtra ?? 1.25;
        }
    } catch (e) { console.warn('Erro ao carregar parâmetros:', e); }

    try {
        const snap = await getDocs(colEmpresa('funcionarios'));
        S.funcionarios = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
        document.getElementById('proc-status').innerHTML = `<p style="color:var(--rh-danger);">Erro ao carregar colaboradores: ${e.message}</p>`;
    }
}
