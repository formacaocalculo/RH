// assets/js/modules/funcionarios.js
import { db } from '../app.js';
import { collection, getDocs, doc, getDoc, query, where }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { calcularDireitoFerias } from './ferias-utils.js';

// ─── Sidebar partilhada ───────────────────────────────────────────────────────
function sidebar(ativo = 'funcionarios') {
    const btn = (id, icon, label) => {
        const isAtivo = id === ativo;
        return `<button onclick="window.router.navigate('${id}')"
            style="display:block;width:100%;text-align:left;
                   background:${isAtivo ? 'var(--rh-primary)' : 'none'};
                   color:${isAtivo ? 'var(--rh-bg-card)' : 'var(--rh-text-subtle)'};
                   padding:10px;border:none;cursor:pointer;font-size:14px;
                   border-radius:6px;margin-bottom:4px;
                   font-weight:${isAtivo ? 'bold' : 'normal'};">
            ${icon} ${label}</button>`;
    };
    return `
    <aside style="width:260px;background:var(--rh-primary);color:var(--rh-bg-card);padding:20px;flex-shrink:0;">
        <div style="display:flex;align-items:center;margin-bottom:30px;">
            <div style="background:var(--rh-primary-light);padding:8px;border-radius:8px;margin-right:10px;">🏢</div>
            <div><h3 style="margin:0;font-size:16px;">Portal RH</h3>
                 <small style="color:var(--rh-text-subtle);">Gestão de Vencimentos</small></div>
        </div>
        <nav>
            <p style="color:var(--rh-text-muted);font-size:11px;text-transform:uppercase;font-weight:bold;margin:0 0 8px 0;">Principal</p>
            ${btn('dashboard','📊','Dashboard')}
            <p style="color:var(--rh-text-muted);font-size:11px;text-transform:uppercase;font-weight:bold;margin:16px 0 8px 0;">Gestão</p>
            ${btn('funcionarios','👥','Colaboradores')}
            ${btn('criar-funcionario','➕','Novo Funcionário')}
            ${btn('assiduidade','📅','Assiduidade')}
            ${btn('processamento','⚙️','Processamento')}
            ${btn('recibos','📄','Recibos')}
            <p style="color:var(--rh-text-muted);font-size:11px;text-transform:uppercase;font-weight:bold;margin:16px 0 8px 0;">Configurações</p>
            ${btn('parametrizacao','⚙️','Parametrização')}
        </nav>
    </aside>`;
}

export function render() {
    return `
    <div style="display:flex;min-height:100vh;background:var(--rh-bg);font-family:sans-serif;">
        ${sidebar('funcionarios')}
        <main style="flex:1;padding:30px;overflow-y:auto;">
            <header style="display:flex;justify-content:space-between;align-items:center;margin-bottom:22px;">
                <div>
                    <h2 style="margin:0;font-size:24px;color:var(--rh-primary);">Colaboradores</h2>
                    <p style="color:var(--rh-text-muted);margin:4px 0 0;font-size:14px;">
                        Clique numa linha para abrir a ficha. Ano de referência: <strong id="func-ano-ref"></strong>
                    </p>
                </div>
                <div style="display:flex;gap:10px;">
                    <input id="func-pesquisa" type="text" placeholder="🔍 Pesquisar nome ou NIF…"
                        oninput="window._funcFiltrar()"
                        style="padding:9px 14px;border:1px solid var(--rh-border);border-radius:6px;font-size:14px;width:230px;">
                    <button onclick="window.router.navigate('criar-funcionario')"
                        style="background:var(--rh-primary);color:var(--rh-bg-card);border:none;padding:10px 18px;border-radius:6px;cursor:pointer;font-size:14px;font-weight:500;">
                        ➕ Novo
                    </button>
                    <button onclick="window.router.navigate('dashboard')"
                        style="background:var(--rh-bg-muted);color:var(--rh-text-muted);border:1px solid var(--rh-border);padding:10px 18px;border-radius:6px;cursor:pointer;font-size:14px;">
                        ✕ Fechar
                    </button>
                </div>
            </header>

            <div id="alertas-nib" style="margin-bottom:16px;"></div>

            <div style="background:var(--rh-bg-card);border-radius:12px;box-shadow:0 2px 4px rgba(0,0,0,0.04);overflow:hidden;">
                <table style="width:100%;border-collapse:collapse;font-size:14px;">
                    <thead>
                        <tr style="background:var(--rh-bg-muted);color:var(--rh-text-subtle);text-transform:uppercase;font-size:11px;border-bottom:2px solid var(--rh-border);">
                            <th style="padding:13px 16px;text-align:left;">Nome</th>
                            <th style="padding:13px 16px;text-align:left;">NIF</th>
                            <th style="padding:13px 16px;text-align:left;">Cargo</th>
                            <th style="padding:13px 16px;text-align:left;">Admissão</th>
                            <th style="padding:13px 16px;text-align:right;">Salário Base</th>
                            <th style="padding:13px 16px;text-align:center;">NIB</th>
                            <th style="padding:13px 16px;text-align:center;" title="Dias de férias a que tem direito este ano">Direito</th>
                            <th style="padding:13px 16px;text-align:center;" title="Dias marcados (gozados)">Marcados</th>
                            <th style="padding:13px 16px;text-align:center;" title="Dias ainda disponíveis para marcar">Disponíveis</th>
                        </tr>
                    </thead>
                    <tbody id="tbody-func">
                        <tr><td colspan="9" style="text-align:center;padding:40px;color:var(--rh-text-subtle);font-style:italic;">
                            A carregar…
                        </td></tr>
                    </tbody>
                </table>
            </div>

            <p id="func-vazio" style="display:none;text-align:center;padding:50px;color:var(--rh-text-subtle);font-style:italic;
               background:var(--rh-bg-card);border-radius:12px;margin-top:16px;box-shadow:0 2px 4px rgba(0,0,0,0.04);">
                Nenhum colaborador encontrado.
            </p>
        </main>
    </div>`;
}

// ─── Estado ───────────────────────────────────────────────────────────────────
let _lista = [];
let _limiteParam = 22;
const _anoRef = new Date().getFullYear();

// ─── Funções globais ──────────────────────────────────────────────────────────
window._funcFiltrar = function () {
    const t = (document.getElementById('func-pesquisa')?.value || '').toLowerCase();
    _renderTabela(_lista.filter(f =>
        (f.nome || '').toLowerCase().includes(t) || (f.nif || '').includes(t)
    ));
};

window._abrirFicha = function (id) {
    window._fichaFuncId = id;
    window.router.navigate('ficha-funcionario');
};

// ─── Render tabela ────────────────────────────────────────────────────────────
function _renderTabela(lista) {
    const tbody = document.getElementById('tbody-func');
    const vazio = document.getElementById('func-vazio');
    if (!tbody) return;

    if (!lista.length) {
        tbody.innerHTML = '';
        if (vazio) vazio.style.display = 'block';
        return;
    }
    if (vazio) vazio.style.display = 'none';

    tbody.innerHTML = lista.map((f, i) => {
        const direito     = calcularDireitoFerias(f.admissao, _anoRef, _limiteParam);
        const anoStr      = String(_anoRef);
        const marcados    = (f.diasFerias  || []).filter(d => d.startsWith(anoStr)).length;
        const gozados     = (f.diasGozados || []).filter(d => d.startsWith(anoStr)).length;
        const disponiveis = Math.max(direito - marcados, 0);

        const admissao = f.admissao
            ? (() => { const p=f.admissao.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; })()
            : '—';
        const salario = f.salarioBase
            ? f.salarioBase.toLocaleString('pt-PT', {style:'currency', currency:'EUR'})
            : '—';
        const rowBg = i % 2 === 0 ? 'var(--rh-bg-card)' : 'var(--rh-bg-muted)';

        const nibBadge = f.nibValido
            ? `<span style="color:var(--rh-secondary);font-size:16px;" title="NIB registado">✔</span>`
            : `<span style="color:var(--rh-warning);font-size:16px;" title="NIB em falta">⚠️</span>`;

        const marcBadge = marcados > 0
            ? `<span style="background:var(--rh-primary-soft);color:var(--rh-primary);padding:3px 10px;border-radius:10px;font-size:12px;font-weight:600;"
                     title="${gozados} gozado(s) de ${marcados} marcado(s)">${marcados} <span style="color:var(--rh-text-subtle);font-weight:400;">(${gozados}✔)</span></span>`
            : `<span style="color:var(--rh-border);font-size:13px;">—</span>`;

        const dispColor  = disponiveis > 0 ? 'var(--rh-success)' : 'var(--rh-danger-dark)';
        const dispBg     = disponiveis > 0 ? 'var(--rh-success-bg)' : 'var(--rh-danger-bg)';
        const dispBadge  = `<span style="background:${dispBg};color:${dispColor};padding:3px 10px;border-radius:10px;font-size:12px;font-weight:600;">${disponiveis}</span>`;

        return `
        <tr onclick="window._abrirFicha('${f.id}')"
            style="border-bottom:1px solid var(--rh-border);background:${rowBg};cursor:pointer;transition:background .12s;"
            onmouseover="this.style.background='var(--rh-primary-soft)'"
            onmouseout="this.style.background='${rowBg}'">
            <td style="padding:12px 16px;font-weight:500;color:var(--rh-primary-dark);">${f.nome || '—'}</td>
            <td style="padding:12px 16px;color:var(--rh-text-muted);font-family:monospace;font-size:13px;">${f.nif || '—'}</td>
            <td style="padding:12px 16px;color:var(--rh-text-muted);">${f.cargo || '—'}</td>
            <td style="padding:12px 16px;color:var(--rh-text-muted);">${admissao}</td>
            <td style="padding:12px 16px;text-align:right;color:var(--rh-primary-dark);font-weight:500;">${salario}</td>
            <td style="padding:12px 16px;text-align:center;">${nibBadge}</td>
            <td style="padding:12px 16px;text-align:center;font-weight:bold;color:var(--rh-primary);font-size:16px;">${direito}</td>
            <td style="padding:12px 16px;text-align:center;">${marcBadge}</td>
            <td style="padding:12px 16px;text-align:center;">${dispBadge}</td>
        </tr>`;
    }).join('');
}

// ─── Init ─────────────────────────────────────────────────────────────────────
export async function init() {
    const anoEl = document.getElementById('func-ano-ref');
    if (anoEl) anoEl.textContent = _anoRef;

    // Carregar parâmetro de limite de férias
    try {
        const ps = await getDoc(doc(db, 'configuracoes', 'empresa_base'));
        if (ps.exists() && ps.data().limiteDiasFerias) {
            _limiteParam = ps.data().limiteDiasFerias;
        }
    } catch (e) { /* usa 22 */ }

    // Carregar funcionários
    try {
        const snap = await getDocs(query(collection(db, 'funcionarios'), where('ativo', '==', true)));
        _lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        _renderTabela(_lista);

        // Alertas NIB
        const semNib = _lista.filter(f => !f.nibValido);
        const alertDiv = document.getElementById('alertas-nib');
        if (alertDiv && semNib.length) {
            alertDiv.innerHTML = semNib.map(f => `
                <div style="display:flex;align-items:center;gap:10px;background:var(--rh-warning-bg);
                            border:1px solid var(--rh-warning);border-radius:8px;padding:10px 16px;margin-bottom:8px;">
                    <span>⚠️</span>
                    <span style="color:var(--rh-warning-text);font-size:13px;">
                        O funcionário <strong>${f.nome}</strong> (NIF: ${f.nif}) ainda não forneceu NIB.
                    </span>
                </div>`).join('');
        }
    } catch (e) {
        const tbody = document.getElementById('tbody-func');
        if (tbody) tbody.innerHTML =
            `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--rh-danger);">Erro: ${e.message}</td></tr>`;
    }
}
