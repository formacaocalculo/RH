// assets/js/modules/relatorios-admin.js
// Relatórios GLOBAIS (área de Administração): percorrem TODAS as empresas da
// app e mostram os dados agrupados por empresa, sem o admin ter de entrar em
// cada uma. Três separadores: Férias, Assiduidade, Vencimentos.

import { getDocs, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { isAdmin, listarTodasEmpresasAdmin, obterPerfis, colDeEmpresa, docDeEmpresa } from './tenant.js';
import { calcularDireitoFerias } from './ferias-utils.js';
import { TIPOS_LABEL, contarUnidades, usaHora, contaComoFaltaAss } from './assiduidade.js';
import { esc } from './html-utils.js';

const MESES_CURTO = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const fmt = (v) => (v || 0).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });

let S = { aba: 'ferias', ano: new Date().getFullYear(), empresas: [], perfis: {}, cache: { ferias: {}, assiduidade: {}, vencimentos: {} } };

// Formata número monetário para CSV pt-PT (vírgula decimal, sem símbolo).
const num2 = (v) => (v || 0).toFixed(2).replace('.', ',');

// Gera e descarrega um CSV (separador ';' + BOM UTF-8 → abre certo no Excel pt-PT).
function descarregarCSV(nomeFicheiro, headers, rows) {
    const cell = (v) => {
        const s = (v === null || v === undefined) ? '' : String(v);
        return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const texto = [headers, ...rows].map(r => r.map(cell).join(';')).join('\r\n');
    const blob = new Blob(['\ufeff' + texto], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeFicheiro.replace(/[\\/:*?"<>|]+/g, '_');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

const NOME_ABA = { ferias: 'Ferias', assiduidade: 'Assiduidade', vencimentos: 'Vencimentos' };

export function render() {
    return `
    <div style="min-height:100vh;background:var(--rh-bg);font-family:sans-serif;">
        <header style="background:var(--rh-primary);color:var(--rh-bg-card);padding:18px 28px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
            <div style="display:flex;align-items:center;gap:12px;">
                <div style="background:var(--rh-primary-light);padding:8px;border-radius:9px;">📊</div>
                <div>
                    <h1 style="margin:0;font-size:18px;">Relatórios Globais</h1>
                    <small style="color:var(--rh-text-subtle);">Todas as empresas · por empresa</small>
                </div>
            </div>
            <div style="display:flex;gap:8px;align-items:center;">
                <label style="font-size:13px;">Ano</label>
                <input type="number" id="rel-ano" min="2000" max="2100" value="${S.ano}"
                    style="width:90px;padding:8px;border:none;border-radius:6px;font-size:13px;">
                <button onclick="window._relRecarregar()" style="background:var(--rh-accent);color:var(--rh-text);border:none;padding:8px 14px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:bold;">Atualizar</button>
                <button onclick="window._relCsvTudo()" title="Exportar todas as empresas (separador atual) para CSV" style="background:var(--rh-primary-light);color:var(--rh-bg-card);border:none;padding:8px 12px;border-radius:6px;cursor:pointer;font-size:13px;">⬇ CSV todas</button>
                <button onclick="window.print()" style="background:var(--rh-primary-light);color:var(--rh-bg-card);border:none;padding:8px 12px;border-radius:6px;cursor:pointer;font-size:13px;">🖨️</button>
                <button onclick="window.router.navigate('admin')" style="background:rgba(255,255,255,0.15);color:var(--rh-bg-card);border:none;padding:8px 14px;border-radius:6px;cursor:pointer;font-size:13px;">← Administração</button>
            </div>
        </header>

        <div style="padding:24px 28px;">
            <div style="display:flex;gap:6px;border-bottom:2px solid var(--rh-border);margin-bottom:20px;">
                ${[['ferias', '🏖️ Férias'], ['assiduidade', '📅 Assiduidade'], ['vencimentos', '💶 Vencimentos']]
                    .map(([k, lbl]) => `<button id="rel-tab-${k}" onclick="window._relAba('${k}')"
                        style="background:none;border:none;border-bottom:3px solid transparent;padding:10px 16px;cursor:pointer;font-size:14px;color:var(--rh-text-muted);">${lbl}</button>`).join('')}
            </div>
            <div id="rel-conteudo">
                <p style="padding:30px;text-align:center;color:var(--rh-text-subtle);font-style:italic;">A carregar…</p>
            </div>
        </div>
    </div>`;
}

function tituloEmpresa(emp) {
    const email = S.perfis[emp.donoUid]?.email;
    return `<div style="padding:12px 16px;background:var(--rh-primary-soft);border-radius:8px 8px 0 0;font-weight:bold;color:var(--rh-primary);display:flex;justify-content:space-between;align-items:center;gap:12px;">
        <span>🏢 ${esc(emp.nome) || '—'} <span style="font-weight:400;font-size:12px;color:var(--rh-text-muted);">· ${email ? esc(email) : esc((emp.donoUid || '').slice(0, 12) + '…')}</span></span>
        <button onclick="window._relCsv('${esc(emp.id)}')" title="Exportar esta empresa para CSV/Excel"
            style="background:var(--rh-bg-card);color:var(--rh-primary);border:1px solid var(--rh-border);padding:5px 10px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:bold;white-space:nowrap;">
            ⬇ CSV
        </button>
    </div>`;
}

function caixaVazia(msg) {
    return `<p style="padding:16px;margin:0;color:var(--rh-text-subtle);font-style:italic;font-size:13px;">${esc(msg)}</p>`;
}

async function carregarFuncs(emp) {
    const funcs = [];
    const snap = await getDocs(colDeEmpresa(emp.id, emp.donoUid, 'funcionarios'));
    snap.forEach(d => funcs.push({ id: d.id, ...d.data() }));
    funcs.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt'));
    return funcs;
}

// ─── Férias ─────────────────────────────────────────────────────────────────
async function blocoFerias(emp) {
    let funcs;
    try { funcs = await carregarFuncs(emp); }
    catch (e) { return tituloEmpresa(emp) + caixaVazia('Erro ao ler colaboradores: ' + e.message); }
    if (!funcs.length) return tituloEmpresa(emp) + caixaVazia('Sem colaboradores.');

    let limite = 22;
    try { const c = await getDoc(docDeEmpresa(emp.id, emp.donoUid, 'configuracoes', 'empresa_base')); if (c.exists() && c.data().limiteDiasFerias) limite = c.data().limiteDiasFerias; } catch (e) {}

    const anoStr = String(S.ano);
    const linhas = funcs.map(f => {
        const direito = calcularDireitoFerias(f.admissao, S.ano, limite);
        const dias = (f.diasFerias || []).filter(d => d.startsWith(anoStr));
        const porMes = new Array(12).fill(0);
        dias.forEach(d => { const m = parseInt(d.slice(5, 7), 10) - 1; if (m >= 0 && m < 12) porMes[m]++; });
        return { f, porMes, direito, marcados: dias.length, disp: Math.max(direito - dias.length, 0) };
    });

    const cel = v => v > 0 ? `<td style="padding:7px 5px;text-align:center;background:var(--rh-success-bg);color:var(--rh-success-text);font-weight:600;">${v}</td>` : `<td style="padding:7px 5px;text-align:center;color:var(--rh-border);">·</td>`;

    S.cache.ferias[emp.id] = {
        nome: emp.nome || emp.id,
        headers: ['Colaborador', ...MESES_CURTO, 'Direito', 'Marcados', 'Disponiveis'],
        rows: linhas.map(l => [l.f.nome || '', ...l.porMes, l.direito, l.marcados, l.disp]),
    };

    return tituloEmpresa(emp) + `
        <table style="width:100%;border-collapse:collapse;font-size:12px;min-width:880px;">
            <thead><tr style="background:var(--rh-bg-muted);color:var(--rh-text-muted);font-size:10px;text-transform:uppercase;">
                <th style="padding:7px 14px;text-align:left;">Colaborador</th>
                ${MESES_CURTO.map(m => `<th style="padding:7px 5px;text-align:center;">${m}</th>`).join('')}
                <th style="padding:7px 5px;text-align:center;">Direito</th><th style="padding:7px 5px;text-align:center;">Marc.</th><th style="padding:7px 5px;text-align:center;">Disp.</th>
            </tr></thead>
            <tbody>${linhas.map((l, i) => `<tr style="border-top:1px solid var(--rh-border);background:${i % 2 ? 'var(--rh-bg-muted)' : 'var(--rh-bg-card)'};">
                <td style="padding:7px 14px;font-weight:500;white-space:nowrap;">${esc(l.f.nome) || '—'}</td>
                ${l.porMes.map(cel).join('')}
                <td style="padding:7px 5px;text-align:center;color:var(--rh-text-muted);">${l.direito}</td>
                <td style="padding:7px 5px;text-align:center;font-weight:600;">${l.marcados}</td>
                <td style="padding:7px 5px;text-align:center;"><span style="background:${l.disp > 0 ? 'var(--rh-success-bg)' : 'var(--rh-danger-bg)'};color:${l.disp > 0 ? 'var(--rh-success)' : 'var(--rh-danger-dark)'};padding:1px 8px;border-radius:10px;font-weight:600;">${l.disp}</span></td>
            </tr>`).join('')}</tbody>
        </table>`;
}

// ─── Assiduidade ────────────────────────────────────────────────────────────
async function blocoAssiduidade(emp) {
    let funcs;
    try { funcs = await carregarFuncs(emp); }
    catch (e) { return tituloEmpresa(emp) + caixaVazia('Erro ao ler colaboradores: ' + e.message); }
    if (!funcs.length) return tituloEmpresa(emp) + caixaVazia('Sem colaboradores.');

    const anoStr = String(S.ano);
    const linhas = [];
    for (const f of funcs) {
        let aus = [];
        try { const a = await getDoc(docDeEmpresa(emp.id, emp.donoUid, 'ausencias', f.id)); if (a.exists()) aus = a.data().ausencias || []; } catch (e) {}
        const porMes = new Array(12).fill(0); let faltas = 0, horas = 0;
        aus.forEach(a => {
            if (usaHora(a.tipo)) { if ((a.dataInicio || '').startsWith(anoStr)) horas += contarUnidades(a, 'hora'); return; }
            if (!a.dataInicio || !a.dataFim) return;
            const conta = contaComoFaltaAss(a.tipo);
            const ini = new Date(a.dataInicio + 'T00:00:00'), fim = new Date(a.dataFim + 'T00:00:00');
            for (let d = new Date(ini); d <= fim; d.setDate(d.getDate() + 1)) {
                if (d.getFullYear() !== S.ano) continue;
                porMes[d.getMonth()]++; if (conta) faltas++;
            }
        });
        linhas.push({ f, porMes, total: porMes.reduce((s, v) => s + v, 0), faltas, horas });
    }

    const cel = v => v > 0 ? `<td style="padding:7px 5px;text-align:center;background:var(--rh-warning-bg);color:var(--rh-warning-text);font-weight:600;">${v}</td>` : `<td style="padding:7px 5px;text-align:center;color:var(--rh-border);">·</td>`;

    S.cache.assiduidade[emp.id] = {
        nome: emp.nome || emp.id,
        headers: ['Colaborador', ...MESES_CURTO, 'Total dias', 'Contam falta', 'Horas avulsas'],
        rows: linhas.map(l => [l.f.nome || '', ...l.porMes, l.total, l.faltas, l.horas]),
    };

    return tituloEmpresa(emp) + `
        <table style="width:100%;border-collapse:collapse;font-size:12px;min-width:960px;">
            <thead><tr style="background:var(--rh-bg-muted);color:var(--rh-text-muted);font-size:10px;text-transform:uppercase;">
                <th style="padding:7px 14px;text-align:left;">Colaborador</th>
                ${MESES_CURTO.map(m => `<th style="padding:7px 5px;text-align:center;">${m}</th>`).join('')}
                <th style="padding:7px 5px;text-align:center;">Total</th><th style="padding:7px 5px;text-align:center;">Falta</th><th style="padding:7px 5px;text-align:center;">Horas</th>
            </tr></thead>
            <tbody>${linhas.map((l, i) => `<tr style="border-top:1px solid var(--rh-border);background:${i % 2 ? 'var(--rh-bg-muted)' : 'var(--rh-bg-card)'};">
                <td style="padding:7px 14px;font-weight:500;white-space:nowrap;">${esc(l.f.nome) || '—'}</td>
                ${l.porMes.map(cel).join('')}
                <td style="padding:7px 5px;text-align:center;font-weight:600;">${l.total || '·'}</td>
                <td style="padding:7px 5px;text-align:center;">${l.faltas > 0 ? `<span style="background:var(--rh-danger-bg);color:var(--rh-danger-text);padding:1px 8px;border-radius:10px;font-weight:600;">${l.faltas}</span>` : '·'}</td>
                <td style="padding:7px 5px;text-align:center;color:var(--rh-text-muted);">${l.horas > 0 ? l.horas + 'h' : '·'}</td>
            </tr>`).join('')}</tbody>
        </table>`;
}

// ─── Vencimentos ────────────────────────────────────────────────────────────
async function blocoVencimentos(emp) {
    let docs = [];
    try { const snap = await getDocs(colDeEmpresa(emp.id, emp.donoUid, 'processamentos')); snap.forEach(d => docs.push({ id: d.id, ...d.data() })); }
    catch (e) { return tituloEmpresa(emp) + caixaVazia('Erro ao ler processamentos: ' + e.message); }

    const doAno = docs.filter(d => Number(d.ano) === S.ano);
    if (!doAno.length) return tituloEmpresa(emp) + caixaVazia(`Sem vencimentos processados em ${S.ano}.`);

    const porColab = {};
    doAno.forEach(p => (p.linhas || []).forEach(l => {
        const k = l.funcId || l.nome;
        if (!porColab[k]) porColab[k] = { nome: l.nome || '—', base: 0, subsidio: 0, ss: 0, irs: 0, liquido: 0, n: 0 };
        const c = porColab[k];
        c.base += l.vencimentoBase || 0; c.subsidio += l.subsidioRefeicao || 0; c.ss += l.descontoSS || 0; c.irs += l.retencaoIRS || 0; c.liquido += l.liquido || 0; c.n++;
    }));
    const colabs = Object.values(porColab).sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
    const t = { base: 0, subsidio: 0, ss: 0, irs: 0, liquido: 0 };
    colabs.forEach(c => { t.base += c.base; t.subsidio += c.subsidio; t.ss += c.ss; t.irs += c.irs; t.liquido += c.liquido; });

    S.cache.vencimentos[emp.id] = {
        nome: emp.nome || emp.id,
        headers: ['Colaborador', 'Meses', 'Base', 'Subsidio', 'SS', 'IRS', 'Liquido'],
        rows: [
            ...colabs.map(c => [c.nome, c.n, num2(c.base), num2(c.subsidio), num2(c.ss), num2(c.irs), num2(c.liquido)]),
            ['TOTAL', '', num2(t.base), num2(t.subsidio), num2(t.ss), num2(t.irs), num2(t.liquido)],
        ],
    };

    return tituloEmpresa(emp) + `
        <table style="width:100%;border-collapse:collapse;font-size:12px;min-width:720px;">
            <thead><tr style="background:var(--rh-bg-muted);color:var(--rh-text-muted);font-size:10px;text-transform:uppercase;">
                <th style="padding:7px 14px;text-align:left;">Colaborador</th><th style="padding:7px 10px;text-align:center;">Meses</th>
                <th style="padding:7px 10px;text-align:right;">Base</th><th style="padding:7px 10px;text-align:right;">Subsídio</th>
                <th style="padding:7px 10px;text-align:right;">SS</th><th style="padding:7px 10px;text-align:right;">IRS</th><th style="padding:7px 14px;text-align:right;">Líquido</th>
            </tr></thead>
            <tbody>${colabs.map((c, i) => `<tr style="border-top:1px solid var(--rh-border);background:${i % 2 ? 'var(--rh-bg-muted)' : 'var(--rh-bg-card)'};">
                <td style="padding:7px 14px;font-weight:500;">${esc(c.nome)}</td>
                <td style="padding:7px 10px;text-align:center;color:var(--rh-text-muted);">${c.n}</td>
                <td style="padding:7px 10px;text-align:right;">${fmt(c.base)}</td>
                <td style="padding:7px 10px;text-align:right;color:var(--rh-secondary);">${fmt(c.subsidio)}</td>
                <td style="padding:7px 10px;text-align:right;color:var(--rh-warning);">−${fmt(c.ss)}</td>
                <td style="padding:7px 10px;text-align:right;color:var(--rh-danger);">−${fmt(c.irs)}</td>
                <td style="padding:7px 14px;text-align:right;font-weight:bold;color:var(--rh-primary);">${fmt(c.liquido)}</td>
            </tr>`).join('')}</tbody>
            <tfoot><tr style="background:var(--rh-bg-muted);font-weight:bold;border-top:2px solid var(--rh-border);">
                <td style="padding:7px 14px;" colspan="2">Total da empresa</td>
                <td style="padding:7px 10px;text-align:right;">${fmt(t.base)}</td>
                <td style="padding:7px 10px;text-align:right;color:var(--rh-secondary);">${fmt(t.subsidio)}</td>
                <td style="padding:7px 10px;text-align:right;color:var(--rh-warning);">−${fmt(t.ss)}</td>
                <td style="padding:7px 10px;text-align:right;color:var(--rh-danger);">−${fmt(t.irs)}</td>
                <td style="padding:7px 14px;text-align:right;color:var(--rh-primary);">${fmt(t.liquido)}</td>
            </tr></tfoot>
        </table>`;
}

async function renderAba() {
    const cont = document.getElementById('rel-conteudo');
    ['ferias', 'assiduidade', 'vencimentos'].forEach(k => {
        const t = document.getElementById('rel-tab-' + k);
        if (t) {
            const ativo = k === S.aba;
            t.style.borderBottomColor = ativo ? 'var(--rh-primary)' : 'transparent';
            t.style.color = ativo ? 'var(--rh-primary)' : 'var(--rh-text-muted)';
            t.style.fontWeight = ativo ? 'bold' : 'normal';
        }
    });

    if (!S.empresas.length) {
        cont.innerHTML = `<p style="padding:30px;text-align:center;color:var(--rh-text-subtle);font-style:italic;">Não há empresas registadas.</p>`;
        return;
    }

    cont.innerHTML = `<p style="padding:20px;color:var(--rh-text-subtle);font-style:italic;">A carregar dados de ${S.empresas.length} empresa(s)…</p>`;
    S.cache[S.aba] = {};
    const fn = S.aba === 'ferias' ? blocoFerias : S.aba === 'assiduidade' ? blocoAssiduidade : blocoVencimentos;

    const blocos = [];
    for (const emp of S.empresas) {
        try { blocos.push(await fn(emp)); }
        catch (e) { blocos.push(tituloEmpresa(emp) + caixaVazia('Erro: ' + e.message)); }
    }
    cont.innerHTML = blocos.map(b => `<div style="background:var(--rh-bg-card);border-radius:10px;margin-bottom:18px;overflow-x:auto;">${b}</div>`).join('');
}

window._relAba = function(aba) { S.aba = aba; renderAba(); };
window._relRecarregar = function() {
    const v = parseInt(document.getElementById('rel-ano').value, 10);
    if (v) S.ano = v;
    renderAba();
};

// Exporta uma empresa (separador atual) para CSV.
window._relCsv = function(empId) {
    const d = S.cache[S.aba]?.[empId];
    if (!d) { alert('Os dados ainda estão a carregar. Tente novamente daqui a instantes.'); return; }
    descarregarCSV(`${NOME_ABA[S.aba]}_${d.nome}_${S.ano}.csv`, d.headers, d.rows);
};

// Exporta TODAS as empresas (separador atual) num único CSV, com a coluna
// "Empresa" à frente para distinguir.
window._relCsvTudo = function() {
    const cache = S.cache[S.aba] || {};
    const ids = Object.keys(cache);
    if (!ids.length) { alert('Os dados ainda estão a carregar. Tente novamente daqui a instantes.'); return; }
    const headers = ['Empresa', ...cache[ids[0]].headers];
    const rows = [];
    ids.forEach(id => cache[id].rows.forEach(r => rows.push([cache[id].nome, ...r])));
    descarregarCSV(`${NOME_ABA[S.aba]}_TODAS_${S.ano}.csv`, headers, rows);
};

export async function init() {
    if (!(await isAdmin())) {
        document.getElementById('app').innerHTML = `
            <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;">
                <div style="text-align:center;">
                    <h2 style="color:var(--rh-danger);">Acesso Restrito</h2>
                    <button onclick="window.router.navigate('empresas')" style="background:var(--rh-accent);border:none;padding:10px 20px;border-radius:6px;cursor:pointer;">← Voltar</button>
                </div>
            </div>`;
        return;
    }
    try {
        S.empresas = await listarTodasEmpresasAdmin();
        S.empresas.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt'));
        S.perfis = await obterPerfis(S.empresas.map(e => e.donoUid));
    } catch (e) {
        document.getElementById('rel-conteudo').innerHTML = `<p style="padding:30px;text-align:center;color:var(--rh-danger);">Erro ao carregar empresas: ${esc(e.message)}</p>`;
        return;
    }
    await renderAba();
}
