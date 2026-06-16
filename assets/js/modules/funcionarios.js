// assets/js/modules/funcionarios.js
import { db } from '../app.js';
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { calcularDireitoFerias } from './ficha-funcionario.js';

export function render() {
    return `
    <div style="display:flex;min-height:100vh;background:#f4f6f9;font-family:sans-serif;">
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
                <button onclick="window.router.navigate('processamento')" style="display:block;width:100%;text-align:left;background:none;color:#8a99ad;padding:10px;border:none;cursor:pointer;font-size:14px;border-radius:6px;margin-bottom:4px;">⚙️ Processamento</button>
                <button onclick="window.router.navigate('recibos')" style="display:block;width:100%;text-align:left;background:none;color:#8a99ad;padding:10px;border:none;cursor:pointer;font-size:14px;border-radius:6px;margin-bottom:4px;">📄 Recibos</button>
                <p style="color:#4f5d73;font-size:11px;text-transform:uppercase;font-weight:bold;margin:16px 0 8px 0;">Configurações</p>
                <button onclick="window.router.navigate('parametrizacao')" style="display:block;width:100%;text-align:left;background:none;color:#8a99ad;padding:10px;border:none;cursor:pointer;font-size:14px;border-radius:6px;">⚙️ Parametrização</button>
            </nav>
        </aside>

        <main style="flex:1;padding:30px;overflow-y:auto;">
            <header style="display:flex;justify-content:space-between;align-items:center;margin-bottom:22px;">
                <div>
                    <h2 style="margin:0;font-size:24px;color:#1a233a;">Colaboradores</h2>
                    <p style="color:#64748b;margin:4px 0 0;font-size:14px;">Clique numa linha para abrir a ficha. Ano de referência: <strong id="func-ano-ref"></strong></p>
                </div>
                <div style="display:flex;gap:10px;">
                    <input id="func-pesquisa" type="text" placeholder="🔍 Pesquisar nome ou NIF…"
                        oninput="window._funcFiltrar()"
                        style="padding:9px 14px;border:1px solid #cbd5e1;border-radius:6px;font-size:14px;width:230px;">
                    <button onclick="window.router.navigate('criar-funcionario')"
                        style="background:#3b82f6;color:#fff;border:none;padding:10px 18px;border-radius:6px;cursor:pointer;font-size:14px;font-weight:500;">➕ Novo</button>
                    <button onclick="window.router.navigate('dashboard')"
                        style="background:#f1f5f9;color:#475569;border:1px solid #cbd5e1;padding:10px 18px;border-radius:6px;cursor:pointer;font-size:14px;">✕ Fechar</button>
                </div>
            </header>

            <div id="alertas-nib" style="margin-bottom:16px;"></div>

            <div style="background:#fff;border-radius:12px;box-shadow:0 2px 4px rgba(0,0,0,0.04);overflow:hidden;">
                <table style="width:100%;border-collapse:collapse;font-size:14px;">
                    <thead>
                        <tr style="background:#f8fafc;color:#94a3b8;text-transform:uppercase;font-size:11px;border-bottom:2px solid #e2e8f0;">
                            <th style="padding:13px 16px;text-align:left;">Nome</th>
                            <th style="padding:13px 16px;text-align:left;">NIF</th>
                            <th style="padding:13px 16px;text-align:left;">Cargo</th>
                            <th style="padding:13px 16px;text-align:left;">Admissão</th>
                            <th style="padding:13px 16px;text-align:right;">Salário Base</th>
                            <th style="padding:13px 16px;text-align:center;">NIB</th>
                            <th style="padding:13px 16px;text-align:center;" title="Dias de férias a que tem direito este ano">Direito</th>
                            <th style="padding:13px 16px;text-align:center;" title="Dias marcados / gozados">Marcados</th>
                            <th style="padding:13px 16px;text-align:center;" title="Dias ainda disponíveis para marcar">Disponíveis</th>
                        </tr>
                    </thead>
                    <tbody id="tbody-func">
                        <tr><td colspan="9" style="text-align:center;padding:40px;color:#94a3b8;font-style:italic;">A carregar…</td></tr>
                    </tbody>
                </table>
            </div>
            <p id="func-vazio" style="display:none;text-align:center;padding:50px;color:#94a3b8;font-style:italic;background:#fff;border-radius:12px;margin-top:16px;box-shadow:0 2px 4px rgba(0,0,0,0.04);">
                Nenhum colaborador encontrado.
            </p>
        </main>
    </div>`;
}

let _lista = [];
let _limiteParam = 22;
const _anoRef = new Date().getFullYear();

window._funcFiltrar = function() {
    const t = (document.getElementById('func-pesquisa')?.value || '').toLowerCase();
    _renderTabela(_lista.filter(f =>
        (f.nome||'').toLowerCase().includes(t) || (f.nif||'').includes(t)
    ));
};

window._abrirFicha = function(id) {
    window._fichaFuncId = id;
    window.router.navigate('ficha-funcionario');
};

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
        const direito    = calcularDireitoFerias(f.admissao, _anoRef, _limiteParam);
        const marcados   = (f.diasFerias  || []).filter(d => d.startsWith(_anoRef)).length;
        const gozados    = (f.diasGozados || []).filter(d => d.startsWith(_anoRef)).length;
        const disponiveis = Math.max(direito - marcados, 0);
        const admissao   = f.admissao ? new Date(f.admissao+'T00:00:00').toLocaleDateString('pt-PT') : '—';
        const salario    = f.salarioBase
            ? f.salarioBase.toLocaleString('pt-PT',{style:'currency',currency:'EUR'}) : '—';
        const rowBg = i%2===0 ? '#fff' : '#f8fafc';

        const nibBadge = f.nibValido
            ? `<span style="color:#10b981;font-size:16px;" title="NIB registado">✔</span>`
            : `<span style="color:#f59e0b;font-size:16px;" title="NIB em falta">⚠️</span>`;

        // badge de marcados: mostra marcados/gozados
        const marcBadge = marcados > 0
            ? `<span style="background:#eff6ff;color:#3b82f6;padding:3px 8px;border-radius:10px;font-size:11px;font-weight:600;"
                    title="${gozados} gozados de ${marcados} marcados">${marcados} (${gozados}✔)</span>`
            : `<span style="color:#cbd5e1;font-size:12px;">—</span>`;

        const dispBadge = disponiveis > 0
            ? `<span style="background:#f0fdf4;color:#16a34a;padding:3px 8px;border-radius:10px;font-size:11px;font-weight:600;">${disponiveis}</span>`
            : `<span style="background:#fef2f2;color:#dc2626;padding:3px 8px;border-radius:10px;font-size:11px;font-weight:600;">0</span>`;

        return `<tr onclick="window._abrirFicha('${f.id}')"
            style="border-bottom:1px solid #e2e8f0;background:${rowBg};cursor:pointer;transition:background .12s;"
            onmouseover="this.style.background='#eff6ff'" onmouseout="this.style.background='${rowBg}'">
            <td style="padding:12px 16px;font-weight:500;color:#1e293b;">${f.nome||'—'}</td>
            <td style="padding:12px 16px;color:#475569;font-family:monospace;font-size:13px;">${f.nif||'—'}</td>
            <td style="padding:12px 16px;color:#475569;">${f.cargo||'—'}</td>
            <td style="padding:12px 16px;color:#475569;">${admissao}</td>
            <td style="padding:12px 16px;text-align:right;color:#1e293b;font-weight:500;">${salario}</td>
            <td style="padding:12px 16px;text-align:center;">${nibBadge}</td>
            <td style="padding:12px 16px;text-align:center;font-weight:bold;color:#1a233a;">${direito}</td>
            <td style="padding:12px 16px;text-align:center;">${marcBadge}</td>
            <td style="padding:12px 16px;text-align:center;">${dispBadge}</td>
        </tr>`;
    }).join('');
}

export async function init() {
    const anoEl = document.getElementById('func-ano-ref');
    if (anoEl) anoEl.textContent = _anoRef;

    try {
        // Carregar limite de parâmetros
        const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
        const ps = await getDoc(doc(db, 'configuracoes', 'empresa_base'));
        if (ps.exists() && ps.data().limiteDiasFerias) _limiteParam = ps.data().limiteDiasFerias;
    } catch(e) { /* sem parâmetros, usa 22 */ }

    try {
        const snap = await getDocs(query(collection(db, 'funcionarios'), where('ativo','==',true)));
        _lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        _renderTabela(_lista);

        // Alertas NIB
        const semNib = _lista.filter(f => !f.nibValido);
        const alertDiv = document.getElementById('alertas-nib');
        if (alertDiv && semNib.length) {
            alertDiv.innerHTML = semNib.map(f => `
                <div style="display:flex;align-items:center;gap:10px;background:#fef3c7;border:1px solid #fbbf24;
                            border-radius:8px;padding:10px 16px;margin-bottom:8px;">
                    <span>⚠️</span>
                    <span style="color:#92400e;font-size:13px;">
                        O funcionário <strong>${f.nome}</strong> (NIF: ${f.nif}) ainda não forneceu NIB.
                    </span>
                </div>`).join('');
        }
    } catch(e) {
        document.getElementById('tbody-func').innerHTML =
            `<tr><td colspan="9" style="text-align:center;padding:40px;color:#ef4444;">Erro: ${e.message}</td></tr>`;
    }
}
