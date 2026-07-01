// assets/js/modules/dashboard.js
import { getDocs, query, where, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { colEmpresa, docEmpresa, empresaAtiva } from './tenant.js';
import { renderSidebarHTML, initSidebar } from './sidebar.js';
import { esc, escAttr } from './html-utils.js';

export function render() {
    return `
    <div style="display:flex;min-height:100vh;background:var(--rh-bg);font-family:sans-serif;">
        ${renderSidebarHTML('dashboard')}
        <main style="flex:1;padding:30px;overflow-y:auto;">
            <header style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <div>
                    <h2 style="margin: 0; font-size: 24px; color: var(--rh-primary);">Dashboard</h2>
                    <small id="dash-empresa-nome" style="color: var(--rh-text-subtle);"></small>
                </div>
                <div style="display:flex; gap:10px; align-items:center;">
                    <button onclick="window.router.navigate('criar-funcionario')" style="background-color:var(--rh-primary); color:var(--rh-bg-card); border:none; padding:9px 18px; border-radius:6px; cursor:pointer; font-size:13px; font-weight:500;">➕ Novo Funcionário</button>
                    <span style="color: var(--rh-text-muted); font-size: 14px;">${new Date().toLocaleDateString('pt-PT', {weekday:'long', year:'numeric', month:'long', day:'numeric'})}</span>
                </div>
            </header>

            <!-- Alertas NIB em falta -->
            <div id="alertas-nib" style="margin-bottom: 20px;"></div>
            <div id="alertas-contratos" style="margin-bottom: 20px;"></div>

            <div class="cards-grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px;">
                <div style="background: var(--rh-bg-card); padding: 20px; border-radius: 12px; border-top: 4px solid var(--rh-primary); box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <small style="color: var(--rh-text-muted); text-transform: uppercase; font-size: 11px; font-weight: bold;">Total Colaboradores</small>
                    <h3 id="kpi-total" style="margin: 10px 0 5px 0; font-size: 28px; color: var(--rh-primary);">—</h3>
                    <small style="color: var(--rh-text-subtle);">Ativos no sistema</small>
                </div>
                <div style="background: var(--rh-bg-card); padding: 20px; border-radius: 12px; border-top: 4px solid var(--rh-secondary); box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <small style="color: var(--rh-text-muted); text-transform: uppercase; font-size: 11px; font-weight: bold;">Massa Salarial Bruta</small>
                    <h3 id="kpi-salarios" style="margin: 10px 0 5px 0; font-size: 28px; color: var(--rh-primary);">—</h3>
                    <small style="color: var(--rh-text-subtle);">Este mês</small>
                </div>
                <div style="background: var(--rh-bg-card); padding: 20px; border-radius: 12px; border-top: 4px solid var(--rh-warning); box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <small style="color: var(--rh-text-muted); text-transform: uppercase; font-size: 11px; font-weight: bold;">Vencimentos Processados</small>
                    <h3 style="margin: 10px 0 5px 0; font-size: 28px; color: var(--rh-primary);">—</h3>
                    <small style="color: var(--rh-text-subtle);">Este mês</small>
                </div>
                <div style="background: var(--rh-bg-card); padding: 20px; border-radius: 12px; border-top: 4px solid var(--rh-danger); box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <small style="color: var(--rh-text-muted); text-transform: uppercase; font-size: 11px; font-weight: bold;">Total Descontos</small>
                    <h3 style="margin: 10px 0 5px 0; font-size: 28px; color: var(--rh-primary);">—</h3>
                    <small style="color: var(--rh-text-subtle);">SS + IRS (mês actual)</small>
                </div>
            </div>

            <div style="background: var(--rh-bg-card); padding: 25px; border-radius: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h4 style="margin: 0; font-size: 16px; color: var(--rh-primary);">Últimos Processamentos</h4>
                    <button onclick="window.router.navigate('processamento')" style="background-color: var(--rh-primary); color: var(--rh-bg-card); border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 500;">Processar novo →</button>
                </div>

                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
                    <thead>
                        <tr style="color: var(--rh-text-subtle); border-bottom: 1px solid var(--rh-border); text-transform: uppercase; font-size: 11px;">
                            <th style="padding: 12px 0;">Colaborador</th>
                            <th>Mês / Ano</th>
                            <th>Salário Bruto</th>
                            <th>Líquido</th>
                            <th>SS</th>
                            <th>IRS</th>
                            <th>Estado</th>
                        </tr>
                    </thead>
                    <tbody id="tabela-processamentos"></tbody>
                </table>

                <div id="mensagem-status" style="text-align: center; color: var(--rh-text-subtle); padding: 40px 0; font-style: italic;">
                    Carregando dados do painel...
                </div>
            </div>
        </main>
    </div>
    `;
}

export async function init() {
    await initSidebar();
    const emp = await empresaAtiva();
    const nomeEl = document.getElementById('dash-empresa-nome');
    if (nomeEl) nomeEl.textContent = emp ? emp.nome : '';

    await _carregarAlertas();
    await _carregarAlertasContratos();
    await _carregarKPIs();
}

const DIAS_ALERTA_CONTRATO = 60; // antecedência por omissão

async function _carregarAlertasContratos() {
    const container = document.getElementById('alertas-contratos');
    if (!container) return;
    try {
        const snap = await getDocs(colEmpresa('funcionarios'));
        const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
        const limite = new Date(hoje.getTime() + DIAS_ALERTA_CONTRATO * 864e5);
        let aTerminar = 0, expirados = 0;
        snap.forEach(d => {
            const f = d.data();
            if (f.ativo === false || f.dataCessacao) return;      // já saiu
            if (!f.dataFimContrato) return;                       // sem termo / sem fim previsto
            const fim = new Date(f.dataFimContrato + 'T00:00:00');
            if (fim < hoje) expirados++;
            else if (fim <= limite) aTerminar++;
        });
        const total = aTerminar + expirados;
        if (!total) { container.innerHTML = ''; return; }
        const partes = [];
        if (aTerminar) partes.push(`${aTerminar} a terminar nos próximos ${DIAS_ALERTA_CONTRATO} dias`);
        if (expirados) partes.push(`${expirados} já terminado(s) sem cessação registada`);
        container.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:space-between; background:var(--rh-warning-bg); border:1px solid var(--rh-warning); border-radius:8px; padding:12px 18px;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-size:20px;">📑</span>
                    <span style="color:var(--rh-warning-text); font-size:14px;">${total} contrato(s) a precisar de atenção (${esc(partes.join(' · '))}).</span>
                </div>
                <button onclick="window.router.navigate('contratos-terminar')" style="background:var(--rh-warning); color:var(--rh-bg-card); border:none; padding:6px 14px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:bold; white-space:nowrap; margin-left:16px;">
                    Ver relatório
                </button>
            </div>`;
    } catch (e) { console.warn('Erro ao carregar alertas de contratos:', e); }
}

async function _carregarAlertas() {
    const container = document.getElementById('alertas-nib');
    if (!container) return;

    try {
        const q = query(
            colEmpresa('alertas_dashboard'),
            where('resolvido', '==', false),
            where('tipo', '==', 'nib_em_falta')
        );
        const snap = await getDocs(q);

        if (snap.empty) { container.innerHTML = ''; return; }

        let html = '';
        snap.forEach(docSnap => {
            const alerta = docSnap.data();
            html += `
            <div id="alerta-${escAttr(docSnap.id)}" style="display:flex; align-items:center; justify-content:space-between; background:var(--rh-warning-bg); border:1px solid var(--rh-warning); border-radius:8px; padding:12px 18px; margin-bottom:10px;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-size:20px;">⚠️</span>
                    <span style="color:var(--rh-warning-text); font-size:14px;">${esc(alerta.mensagem)}</span>
                </div>
                <button onclick="window._resolverAlertaNIB('${escAttr(docSnap.id)}')" style="background:var(--rh-warning); color:var(--rh-bg-card); border:none; padding:6px 14px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:bold; white-space:nowrap; margin-left:16px;">
                    Marcar como resolvido
                </button>
            </div>`;
        });

        container.innerHTML = html;
    } catch (e) {
        console.warn('Erro ao carregar alertas:', e);
    }
}

window._resolverAlertaNIB = async function(alertaId) {
    try {
        await updateDoc(docEmpresa('alertas_dashboard', alertaId), { resolvido: true });
        const el = document.getElementById(`alerta-${alertaId}`);
        if (el) el.remove();
    } catch (e) {
        alert('Erro ao resolver alerta: ' + e.message);
    }
};

async function _carregarKPIs() {
    try {
        const snap = await getDocs(query(colEmpresa('funcionarios'), where('ativo', '==', true)));
        document.getElementById('kpi-total').textContent = snap.size;

        let massaSalarial = 0;
        snap.forEach(d => { massaSalarial += (d.data().salarioBase || 0); });
        document.getElementById('kpi-salarios').textContent =
            massaSalarial.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });

        document.getElementById('mensagem-status').textContent =
            snap.size === 0 ? 'Nenhum processamento encontrado.' : '';
    } catch (e) {
        console.warn('Erro ao carregar KPIs:', e);
        document.getElementById('mensagem-status').textContent = 'Erro ao carregar dados.';
    }
}
