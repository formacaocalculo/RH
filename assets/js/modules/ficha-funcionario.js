// assets/js/modules/ficha-funcionario.js
import { db } from '../app.js';
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { calcularDireitoFerias, feriadosPortugal } from './ferias-utils.js';

// calcularDireitoFerias e feriadosPortugal importados de ferias-utils.js

// ─── Estado do módulo ─────────────────────────────────────────────────────────
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
               'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

let S = {
    funcId: null,
    func: null,
    ano: new Date().getFullYear(),
    mes: new Date().getMonth(),
    feriados: new Set(),     // "MM-DD"
    limiteDiasFerias: 22,
    direitoAno: 22,
};

// ─── Calendário ───────────────────────────────────────────────────────────────
function renderCal() {
    const cont = document.getElementById('ficha-cal');
    const lblMes = document.getElementById('ficha-cal-label');
    if (!cont || !lblMes || !S.func) return;

    lblMes.textContent = `${MESES[S.mes]} ${S.ano}`;

    const diasFerias  = new Set(S.func.diasFerias  || []);
    const diasGozados = new Set(S.func.diasGozados || []);
    const hoje = new Date();
    const primeiroDia = new Date(S.ano, S.mes, 1).getDay();
    const diasNoMes   = new Date(S.ano, S.mes + 1, 0).getDate();

    let h = `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;">`;

    DIAS_SEMANA.forEach(d =>
        h += `<div style="text-align:center;font-size:11px;font-weight:bold;color:#94a3b8;padding:5px 0;">${d}</div>`
    );
    for (let i = 0; i < primeiroDia; i++) h += `<div></div>`;

    for (let dia = 1; dia <= diasNoMes; dia++) {
        const ds  = `${S.ano}-${String(S.mes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
        const fk  = `${String(S.mes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
        const dow = new Date(S.ano, S.mes, dia).getDay();
        const isWeekend  = dow === 0 || dow === 6;
        const isFeriado  = S.feriados.has(fk);
        const isGozado   = diasGozados.has(ds);
        const isMarcado  = diasFerias.has(ds);
        const isHoje     = hoje.getFullYear()===S.ano && hoje.getMonth()===S.mes && hoje.getDate()===dia;

        let bg='#fff', border='1px solid #e2e8f0', color='#1e293b', cursor='pointer', title='';

        if (isWeekend)  { bg='#f8fafc'; color='#cbd5e1'; cursor='default'; }
        if (isFeriado)  { bg='#fee2e2'; border='1px solid #fca5a5'; color='#991b1b'; cursor='default'; title='Feriado'; }

        // estados de férias sobrepõem-se (gozado > marcado)
        if (isGozado)        { bg='#fecaca'; border='2px solid #ef4444'; color='#7f1d1d'; cursor='pointer'; title='Gozado — clique para desmarcar'; }
        else if (isMarcado)  { bg='#bbf7d0'; border='2px solid #22c55e'; color='#14532d'; cursor='pointer'; title='Marcado — clique para marcar como gozado'; }
        else if (!isWeekend && !isFeriado) { title='Clique para marcar como férias'; }

        if (isHoje) border = (isGozado||isMarcado) ? border : '2px solid #3b82f6';

        const clickable = !isWeekend && !isFeriado;
        const onclick = clickable ? `window._fichaToggle('${ds}')` : '';

        h += `<div onclick="${onclick}" title="${title}"
            style="text-align:center;padding:8px 2px;border-radius:6px;font-size:12px;
                   background:${bg};border:${border};color:${color};cursor:${cursor};
                   font-weight:${isHoje?'bold':'normal'};transition:all .1s;">
            ${dia}</div>`;
    }
    h += `</div>`;
    cont.innerHTML = h;
    renderContadores();
    renderLista();
}

function renderContadores() {
    const anoStr = String(S.ano);
    const marcados  = (S.func.diasFerias  || []).filter(d => d.startsWith(anoStr)).length;
    const gozados   = (S.func.diasGozados || []).filter(d => d.startsWith(anoStr)).length;
    const porGozar  = Math.max(marcados - gozados, 0);
    const disponiveis = Math.max(S.direitoAno - marcados, 0);

    const set = (id, v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
    set('kpi-direito',     S.direitoAno);
    set('kpi-marcados',    marcados);
    set('kpi-gozados',     gozados);
    set('kpi-porgozar',    porGozar);
    set('kpi-disponiveis', disponiveis);
}

function renderLista() {
    const cont = document.getElementById('ficha-lista');
    if (!cont) return;
    const anoStr = String(S.ano);
    const diasFerias  = (S.func.diasFerias  || []).filter(d => d.startsWith(anoStr));
    const gozSet      = new Set((S.func.diasGozados || []).filter(d => d.startsWith(anoStr)));

    if (!diasFerias.length) {
        cont.innerHTML = `<p style="color:#94a3b8;font-style:italic;margin:0;font-size:13px;">Nenhum dia marcado em ${S.ano}.</p>`;
        return;
    }
    cont.innerHTML = diasFerias.map(d => {
        const g = gozSet.has(d);
        const fmt = new Date(d+'T00:00:00').toLocaleDateString('pt-PT',{day:'2-digit',month:'long',weekday:'short'});
        const badge = g
            ? `<span style="background:#fecaca;color:#991b1b;padding:2px 9px;border-radius:10px;font-size:11px;">Gozado</span>`
            : `<span style="background:#bbf7d0;color:#14532d;padding:2px 9px;border-radius:10px;font-size:11px;">Marcado</span>`;
        return `<div style="display:flex;justify-content:space-between;align-items:center;
                            padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:12px;">
            <span style="color:#1e293b;">${fmt}</span>${badge}</div>`;
    }).join('');
}

// ─── Toggle: branco → verde → vermelho → branco ───────────────────────────────
window._fichaToggle = function(ds) {
    const diasFerias  = new Set(S.func.diasFerias  || []);
    const diasGozados = new Set(S.func.diasGozados || []);
    const anoStr = String(S.ano);

    if (diasGozados.has(ds)) {
        // vermelho → branco: desmarcar tudo
        diasGozados.delete(ds);
        diasFerias.delete(ds);
    } else if (diasFerias.has(ds)) {
        // verde → vermelho
        diasGozados.add(ds);
    } else {
        // branco → verde: verificar limite
        const marcadosAno = [...diasFerias].filter(d => d.startsWith(anoStr)).length;
        if (marcadosAno >= S.direitoAno) {
            alert(`Limite de ${S.direitoAno} dias de férias atingido para ${S.ano}.`);
            return;
        }
        diasFerias.add(ds);
    }

    S.func.diasFerias  = [...diasFerias].sort();
    S.func.diasGozados = [...diasGozados].sort();
    renderCal();
};

window._fichaMarcarPassados = function() {
    const hoje = new Date().toISOString().slice(0,10);
    const diasFerias  = new Set(S.func.diasFerias  || []);
    const diasGozados = new Set(S.func.diasGozados || []);
    let n = 0;
    diasFerias.forEach(d => { if (d < hoje && !diasGozados.has(d)) { diasGozados.add(d); n++; } });
    if (!n) { alert('Não há dias anteriores a hoje por marcar como gozados.'); return; }
    S.func.diasGozados = [...diasGozados].sort();
    renderCal();
};

window._fichaGuardar = async function() {
    const btn = document.getElementById('btn-guardar');
    if (!btn || !S.funcId) return;
    btn.textContent = 'A guardar…'; btn.disabled = true;
    try {
        await updateDoc(doc(db, 'funcionarios', S.funcId), {
            diasFerias:  S.func.diasFerias  || [],
            diasGozados: S.func.diasGozados || [],
        });
        btn.textContent = '✔ Guardado!';
        setTimeout(() => { btn.textContent = '💾 Guardar'; btn.disabled = false; }, 2000);
    } catch (e) {
        alert('Erro: ' + e.message);
        btn.textContent = '💾 Guardar'; btn.disabled = false;
    }
};

window._fichaChangeAno = function(v) {
    S.ano = parseInt(v);
    S.direitoAno = calcularDireitoFerias(S.func.admissao, S.ano, S.limiteDiasFerias);
    renderCal();
};

// ─── render() ─────────────────────────────────────────────────────────────────
export function render() {
    return `
    <div style="display:flex;min-height:100vh;background:#f4f6f9;font-family:sans-serif;">

        <!-- Sidebar -->
        <aside style="width:260px;background:#1a233a;color:#fff;padding:20px;flex-shrink:0;">
            <div style="display:flex;align-items:center;margin-bottom:30px;">
                <div style="background:#3b82f6;padding:8px;border-radius:8px;margin-right:10px;">🏢</div>
                <div><h3 style="margin:0;font-size:16px;">Portal RH</h3><small style="color:#8a99ad;">Gestão de Vencimentos</small></div>
            </div>
            <nav>
                <p style="color:#4f5d73;font-size:11px;text-transform:uppercase;font-weight:bold;margin:0 0 8px 0;">Principal</p>
                <button onclick="window.router.navigate('dashboard')" style="display:block;width:100%;text-align:left;background:none;color:#8a99ad;padding:10px;border:none;cursor:pointer;font-size:14px;border-radius:6px;margin-bottom:4px;">📊 Dashboard</button>
                <p style="color:#4f5d73;font-size:11px;text-transform:uppercase;font-weight:bold;margin:16px 0 8px 0;">Gestão</p>
                <button onclick="window.router.navigate('funcionarios')" style="display:block;width:100%;text-align:left;background:#3b82f6;color:#fff;padding:10px;border:none;cursor:pointer;font-size:14px;border-radius:6px;margin-bottom:4px;font-weight:bold;">👥 Colaboradores</button>
                <button onclick="window.router.navigate('criar-funcionario')" style="display:block;width:100%;text-align:left;background:none;color:#8a99ad;padding:10px;border:none;cursor:pointer;font-size:14px;border-radius:6px;margin-bottom:4px;">➕ Novo Funcionário</button>
                <button onclick="window.router.navigate('assiduidade')" style="display:block;width:100%;text-align:left;background:none;color:#8a99ad;padding:10px;border:none;cursor:pointer;font-size:14px;border-radius:6px;margin-bottom:4px;">📅 Assiduidade</button>
                <p style="color:#4f5d73;font-size:11px;text-transform:uppercase;font-weight:bold;margin:16px 0 8px 0;">Configurações</p>
                <button onclick="window.router.navigate('parametrizacao')" style="display:block;width:100%;text-align:left;background:none;color:#8a99ad;padding:10px;border:none;cursor:pointer;font-size:14px;border-radius:6px;">⚙️ Parametrização</button>
            </nav>
        </aside>

        <!-- Main -->
        <main style="flex:1;padding:28px;overflow-y:auto;">

            <!-- Header -->
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:22px;">
                <button onclick="window.router.navigate('funcionarios')"
                    style="background:none;border:1px solid #cbd5e1;padding:7px 14px;border-radius:6px;cursor:pointer;color:#475569;font-size:13px;">← Colaboradores</button>
                <div style="flex:1;">
                    <h2 id="ficha-titulo" style="margin:0;font-size:21px;color:#1a233a;">Ficha do Colaborador</h2>
                    <p id="ficha-sub" style="margin:3px 0 0;font-size:13px;color:#64748b;">A carregar…</p>
                </div>
                <button onclick="window.router.navigate('dashboard')"
                    style="background:#f1f5f9;color:#475569;border:1px solid #cbd5e1;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px;">✕ Fechar</button>
            </div>

            <!-- KPIs -->
            <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:22px;">
                ${[
                    ['kpi-direito',     '#3b82f6', 'Direito',      'dias este ano'],
                    ['kpi-marcados',    '#22c55e', 'Marcados',     'férias planeadas'],
                    ['kpi-gozados',     '#ef4444', 'Gozados',      'já concluídos'],
                    ['kpi-porgozar',    '#f59e0b', 'Por gozar',    'marcados p/ gozar'],
                    ['kpi-disponiveis', '#8b5cf6', 'Disponíveis',  'ainda por marcar'],
                ].map(([id,cor,label,sub]) => `
                <div style="background:#fff;padding:16px;border-radius:10px;border-top:3px solid ${cor};
                            box-shadow:0 2px 4px rgba(0,0,0,0.04);text-align:center;">
                    <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:bold;margin-bottom:5px;">${label}</div>
                    <div id="${id}" style="font-size:28px;font-weight:bold;color:#1a233a;">—</div>
                    <div style="font-size:11px;color:#94a3b8;margin-top:2px;">${sub}</div>
                </div>`).join('')}
            </div>

            <!-- Corpo: calendário + painel direito -->
            <div style="display:grid;grid-template-columns:1fr 320px;gap:18px;align-items:start;">

                <!-- Calendário -->
                <div style="background:#fff;padding:22px;border-radius:12px;box-shadow:0 2px 4px rgba(0,0,0,0.04);">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
                        <h4 style="margin:0;color:#1a233a;font-size:15px;">🗓️ Calendário de Férias</h4>
                        <div style="display:flex;align-items:center;gap:6px;">
                            <select id="ficha-sel-ano" onchange="window._fichaChangeAno(this.value)"
                                style="padding:5px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;background:#fff;"></select>
                            <button id="cal-prev" style="background:#f1f5f9;border:none;border-radius:6px;padding:5px 11px;cursor:pointer;font-size:14px;">‹</button>
                            <span id="ficha-cal-label" style="font-weight:bold;font-size:13px;color:#1a233a;min-width:125px;text-align:center;"></span>
                            <button id="cal-next" style="background:#f1f5f9;border:none;border-radius:6px;padding:5px 11px;cursor:pointer;font-size:14px;">›</button>
                        </div>
                    </div>

                    <div id="ficha-cal" style="user-select:none;"></div>

                    <!-- Legenda -->
                    <div style="display:flex;gap:14px;margin-top:12px;font-size:11px;color:#64748b;flex-wrap:wrap;">
                        <span><i style="display:inline-block;width:11px;height:11px;background:#bbf7d0;border:1px solid #22c55e;border-radius:2px;vertical-align:middle;margin-right:3px;"></i>Marcado</span>
                        <span><i style="display:inline-block;width:11px;height:11px;background:#fecaca;border:1px solid #ef4444;border-radius:2px;vertical-align:middle;margin-right:3px;"></i>Gozado</span>
                        <span><i style="display:inline-block;width:11px;height:11px;background:#fee2e2;border:1px solid #fca5a5;border-radius:2px;vertical-align:middle;margin-right:3px;"></i>Feriado</span>
                        <span><i style="display:inline-block;width:11px;height:11px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:2px;vertical-align:middle;margin-right:3px;"></i>Fim de semana</span>
                    </div>
                    <p style="font-size:11px;color:#94a3b8;margin:8px 0 0;">
                        💡 1.º clique = marcar (🟢) · 2.º clique = gozado (🔴) · 3.º clique = remover
                    </p>

                    <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;">
                        <button onclick="window._fichaMarcarPassados()"
                            style="background:#f1f5f9;border:1px solid #cbd5e1;padding:8px 14px;border-radius:6px;cursor:pointer;font-size:12px;color:#475569;">
                            ✔ Marcar passados como gozados
                        </button>
                        <button id="btn-guardar" onclick="window._fichaGuardar()"
                            style="margin-left:auto;background:#10b981;color:#fff;border:none;padding:8px 20px;
                                   border-radius:6px;cursor:pointer;font-size:13px;font-weight:bold;">
                            💾 Guardar
                        </button>
                    </div>
                </div>

                <!-- Painel direito -->
                <div style="display:flex;flex-direction:column;gap:16px;">

                    <!-- Dados pessoais -->
                    <div style="background:#fff;padding:20px;border-radius:12px;box-shadow:0 2px 4px rgba(0,0,0,0.04);">
                        <h4 style="margin:0 0 14px;color:#1a233a;font-size:13px;border-bottom:2px solid #3b82f6;padding-bottom:7px;">👤 Dados Pessoais</h4>
                        <div id="ficha-pessoais" style="font-size:12px;color:#475569;line-height:1.9;"></div>
                    </div>

                    <!-- Dados profissionais -->
                    <div style="background:#fff;padding:20px;border-radius:12px;box-shadow:0 2px 4px rgba(0,0,0,0.04);">
                        <h4 style="margin:0 0 14px;color:#1a233a;font-size:13px;border-bottom:2px solid #10b981;padding-bottom:7px;">💼 Dados Profissionais</h4>
                        <div id="ficha-prof" style="font-size:12px;color:#475569;line-height:1.9;"></div>
                    </div>

                    <!-- Lista de dias -->
                    <div style="background:#fff;padding:20px;border-radius:12px;box-shadow:0 2px 4px rgba(0,0,0,0.04);">
                        <h4 style="margin:0 0 14px;color:#1a233a;font-size:13px;border-bottom:2px solid #f59e0b;padding-bottom:7px;">📋 Dias Marcados</h4>
                        <div id="ficha-lista" style="max-height:200px;overflow-y:auto;"></div>
                    </div>
                </div>
            </div>
        </main>
    </div>`;
}

// ─── init() ───────────────────────────────────────────────────────────────────
export async function init() {
    const funcId = window._fichaFuncId;
    if (!funcId) { window.router.navigate('funcionarios'); return; }
    S.funcId = funcId;
    S.ano    = new Date().getFullYear();
    S.mes    = new Date().getMonth();
    S.feriados = new Set();

    // Parâmetros
    try {
        const ps = await getDoc(doc(db, 'configuracoes', 'empresa_base'));
        if (ps.exists()) {
            const pd = ps.data();
            S.limiteDiasFerias = pd.limiteDiasFerias || 22;
            const lista = feriadosPortugal(S.ano);
            const ativos = pd.feriadosAtivos || lista.map(f => f.nome);
            lista.forEach(f => { if (ativos.includes(f.nome)) S.feriados.add(f.data); });
            if (pd.feriadosLocais) {
                pd.feriadosLocais.split(',').forEach(s => {
                    const m = s.trim().match(/^(\d{2})\/(\d{2})$/);
                    if (m) S.feriados.add(`${m[2]}-${m[1]}`);
                });
            }
        }
    } catch(e) { console.warn('params:', e); }

    // Funcionário
    try {
        const fs = await getDoc(doc(db, 'funcionarios', funcId));
        if (!fs.exists()) { alert('Funcionário não encontrado.'); window.router.navigate('funcionarios'); return; }
        S.func = { id: fs.id, ...fs.data() };
    } catch(e) { alert('Erro: ' + e.message); return; }

    const f = S.func;
    S.direitoAno = calcularDireitoFerias(f.admissao, S.ano, S.limiteDiasFerias);

    // Header
    document.getElementById('ficha-titulo').textContent = f.nome || 'Colaborador';
    document.getElementById('ficha-sub').textContent =
        `NIF: ${f.nif||'—'}  ·  ${f.cargo||''}  ·  Admissão: ${f.admissao ? new Date(f.admissao+'T00:00:00').toLocaleDateString('pt-PT') : '—'}`;

    // Dados pessoais
    document.getElementById('ficha-pessoais').innerHTML = [
        ['Nome', f.nome],
        ['NIF', f.nif],
        ['Nascimento', f.nascimento ? new Date(f.nascimento+'T00:00:00').toLocaleDateString('pt-PT') : null],
        ['Morada', f.morada],
        ['Contacto', f.contacto],
        ['Email', f.email],
        ['NIB/IBAN', f.nib || '<span style="color:#f59e0b;">⚠️ Em falta</span>'],
    ].map(([k,v]) => `<div><strong>${k}:</strong> ${v||'—'}</div>`).join('');

    // Dados prof
    document.getElementById('ficha-prof').innerHTML = [
        ['Cargo', f.cargo],
        ['Departamento', f.departamento],
        ['Admissão', f.admissao ? new Date(f.admissao+'T00:00:00').toLocaleDateString('pt-PT') : null],
        ['Salário Base', f.salarioBase ? f.salarioBase.toLocaleString('pt-PT',{style:'currency',currency:'EUR'}) : null],
        ['Categoria IRS', f.categoriaIRS],
    ].map(([k,v]) => `<div><strong>${k}:</strong> ${v||'—'}</div>`).join('');

    // Selector de ano
    const anoAdm = f.admissao ? new Date(f.admissao+'T00:00:00').getFullYear() : S.ano;
    const anoAtual = new Date().getFullYear();
    const sel = document.getElementById('ficha-sel-ano');
    for (let a = anoAdm; a <= anoAtual + 1; a++) {
        const o = document.createElement('option');
        o.value = a; o.textContent = a;
        if (a === S.ano) o.selected = true;
        sel.appendChild(o);
    }

    // Navegação meses
    document.getElementById('cal-prev').addEventListener('click', () => {
        if (S.mes === 0) { S.mes=11; S.ano--; } else S.mes--;
        _syncAno(); renderCal();
    });
    document.getElementById('cal-next').addEventListener('click', () => {
        if (S.mes === 11) { S.mes=0; S.ano++; } else S.mes++;
        _syncAno(); renderCal();
    });

    renderCal();
}

function _syncAno() {
    S.direitoAno = calcularDireitoFerias(S.func?.admissao, S.ano, S.limiteDiasFerias);
    const sel = document.getElementById('ficha-sel-ano');
    if (sel) sel.value = S.ano;
}

// feriadosPortugal importado de ferias-utils.js
