// assets/js/modules/funcionarios.js
import { db } from '../app.js';
import { collection, getDocs, query, where, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export function render() {
    return `
    <div class="portal-container" style="display: flex; min-height: 100vh; background-color: #f4f6f9; font-family: sans-serif;">
        <aside style="width: 260px; background-color: #1a233a; color: #fff; padding: 20px; flex-shrink: 0;">
            <div style="display: flex; align-items: center; margin-bottom: 30px;">
                <div style="background-color: #3b82f6; padding: 8px; border-radius: 8px; margin-right: 10px;">🏢</div>
                <div>
                    <h3 style="margin: 0; font-size: 16px;">Portal RH</h3>
                    <small style="color: #8a99ad;">Gestão de Vencimentos</small>
                </div>
            </div>
            <nav>
                <p style="color: #4f5d73; font-size: 11px; text-transform: uppercase; font-weight: bold; margin: 0 0 8px 0;">Principal</p>
                <button onclick="window.router.navigate('dashboard')" style="display:block;width:100%;text-align:left;background:none;color:#8a99ad;padding:10px;border:none;cursor:pointer;font-size:14px;border-radius:6px;margin-bottom:4px;">📊 Dashboard</button>

                <p style="color: #4f5d73; font-size: 11px; text-transform: uppercase; font-weight: bold; margin: 16px 0 8px 0;">Gestão</p>
                <button onclick="window.router.navigate('funcionarios')" style="display:block;width:100%;text-align:left;background-color:#3b82f6;color:#fff;padding:10px;border:none;cursor:pointer;font-size:14px;border-radius:6px;margin-bottom:4px;font-weight:bold;">👥 Colaboradores</button>
                <button onclick="window.router.navigate('criar-funcionario')" style="display:block;width:100%;text-align:left;background:none;color:#8a99ad;padding:10px;border:none;cursor:pointer;font-size:14px;border-radius:6px;margin-bottom:4px;">➕ Novo Funcionário</button>
                <button onclick="window.router.navigate('processamento')" style="display:block;width:100%;text-align:left;background:none;color:#8a99ad;padding:10px;border:none;cursor:pointer;font-size:14px;border-radius:6px;margin-bottom:4px;">⚙️ Processamento</button>
                <button onclick="window.router.navigate('recibos')" style="display:block;width:100%;text-align:left;background:none;color:#8a99ad;padding:10px;border:none;cursor:pointer;font-size:14px;border-radius:6px;margin-bottom:4px;">📄 Recibos</button>

                <p style="color: #4f5d73; font-size: 11px; text-transform: uppercase; font-weight: bold; margin: 16px 0 8px 0;">Configurações</p>
                <button onclick="window.router.navigate('parametrizacao')" style="display:block;width:100%;text-align:left;background:none;color:#8a99ad;padding:10px;border:none;cursor:pointer;font-size:14px;border-radius:6px;">⚙️ Parametrização</button>
            </nav>
        </aside>

        <main style="flex: 1; padding: 30px; overflow-y: auto;">
            <header style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
                <div>
                    <h2 style="margin:0; font-size:24px; color:#1a233a;">Colaboradores</h2>
                    <p style="color:#64748b; margin:4px 0 0 0; font-size:14px;">Lista de todos os funcionários ativos.</p>
                </div>
                <div style="display:flex; gap:10px;">
                    <input id="func-pesquisa" type="text" placeholder="🔍 Pesquisar nome ou NIF..." oninput="window._funcFiltrar()" style="padding:9px 14px; border:1px solid #cbd5e1; border-radius:6px; font-size:14px; width:240px;">
                    <button onclick="window.router.navigate('criar-funcionario')" style="background:#3b82f6;color:#fff;border:none;padding:10px 18px;border-radius:6px;cursor:pointer;font-size:14px;font-weight:500;">➕ Novo</button>
                    <button onclick="window.router.navigate('dashboard')" style="background:#f1f5f9;color:#475569;border:1px solid #cbd5e1;padding:10px 18px;border-radius:6px;cursor:pointer;font-size:14px;">✕ Fechar</button>
                </div>
            </header>

            <div id="alertas-nib-func" style="margin-bottom:16px;"></div>

            <div style="background:#fff; border-radius:12px; box-shadow:0 2px 4px rgba(0,0,0,0.04); overflow:hidden;">
                <table style="width:100%; border-collapse:collapse; font-size:14px;">
                    <thead>
                        <tr style="background:#f8fafc; color:#94a3b8; text-transform:uppercase; font-size:11px; border-bottom:2px solid #e2e8f0;">
                            <th style="padding:14px 16px; text-align:left;">Nome</th>
                            <th style="padding:14px 16px; text-align:left;">NIF</th>
                            <th style="padding:14px 16px; text-align:left;">Cargo</th>
                            <th style="padding:14px 16px; text-align:left;">Departamento</th>
                            <th style="padding:14px 16px; text-align:left;">Admissão</th>
                            <th style="padding:14px 16px; text-align:right;">Salário Base</th>
                            <th style="padding:14px 16px; text-align:center;">NIB</th>
                            <th style="padding:14px 16px; text-align:center;">Férias</th>
                        </tr>
                    </thead>
                    <tbody id="tabela-funcionarios">
                        <tr><td colspan="8" style="text-align:center;padding:40px;color:#94a3b8;font-style:italic;">A carregar...</td></tr>
                    </tbody>
                </table>
            </div>

            <div id="func-sem-resultados" style="display:none; text-align:center; padding:60px; color:#94a3b8; font-style:italic; background:#fff; border-radius:12px; margin-top:16px; box-shadow:0 2px 4px rgba(0,0,0,0.04);">
                Nenhum colaborador encontrado.
            </div>
        </main>
    </div>
    `;
}

let _todosFuncionarios = [];

window._funcFiltrar = function() {
    const termo = document.getElementById('func-pesquisa')?.value.toLowerCase() || '';
    const filtrados = _todosFuncionarios.filter(f =>
        f.nome.toLowerCase().includes(termo) || (f.nif || '').includes(termo)
    );
    _renderTabela(filtrados);
};

function _renderTabela(lista) {
    const tbody = document.getElementById('tabela-funcionarios');
    const semResultados = document.getElementById('func-sem-resultados');
    if (!tbody) return;

    if (lista.length === 0) {
        tbody.innerHTML = '';
        if (semResultados) semResultados.style.display = 'block';
        return;
    }
    if (semResultados) semResultados.style.display = 'none';

    tbody.innerHTML = lista.map((f, i) => {
        const nibOk = f.nibValido;
        const admissao = f.admissao ? new Date(f.admissao).toLocaleDateString('pt-PT') : '—';
        const salario = f.salarioBase
            ? f.salarioBase.toLocaleString('pt-PT', { style:'currency', currency:'EUR' })
            : '—';
        const ferias = Array.isArray(f.diasFerias) ? f.diasFerias.length : 0;
        const rowBg = i % 2 === 0 ? '#fff' : '#f8fafc';

        return `<tr style="border-bottom:1px solid #e2e8f0; background:${rowBg};">
            <td style="padding:13px 16px; font-weight:500; color:#1e293b;">${f.nome || '—'}</td>
            <td style="padding:13px 16px; color:#475569; font-family:monospace;">${f.nif || '—'}</td>
            <td style="padding:13px 16px; color:#475569;">${f.cargo || '—'}</td>
            <td style="padding:13px 16px; color:#475569;">${f.departamento || '—'}</td>
            <td style="padding:13px 16px; color:#475569;">${admissao}</td>
            <td style="padding:13px 16px; text-align:right; color:#1e293b; font-weight:500;">${salario}</td>
            <td style="padding:13px 16px; text-align:center;">
                ${nibOk
                    ? '<span style="color:#10b981; font-size:16px;" title="NIB registado">✔</span>'
                    : '<span style="color:#f59e0b; font-size:16px;" title="NIB em falta">⚠️</span>'}
            </td>
            <td style="padding:13px 16px; text-align:center;">
                <span style="background:#eff6ff; color:#3b82f6; padding:3px 10px; border-radius:12px; font-size:12px; font-weight:600;">${ferias}d</span>
            </td>
        </tr>`;
    }).join('');
}

export async function init() {
    try {
        const snap = await getDocs(query(collection(db, 'funcionarios'), where('ativo', '==', true)));
        _todosFuncionarios = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        _renderTabela(_todosFuncionarios);

        // Alertas NIB
        const semNib = _todosFuncionarios.filter(f => !f.nibValido);
        const alertasDiv = document.getElementById('alertas-nib-func');
        if (alertasDiv && semNib.length > 0) {
            alertasDiv.innerHTML = semNib.map(f => `
                <div style="display:flex;align-items:center;gap:10px;background:#fef3c7;border:1px solid #fbbf24;border-radius:8px;padding:10px 16px;margin-bottom:8px;">
                    <span style="font-size:18px;">⚠️</span>
                    <span style="color:#92400e;font-size:13px;">O funcionário <strong>${f.nome}</strong> (NIF: ${f.nif}) ainda não forneceu NIB.</span>
                </div>
            `).join('');
        }
    } catch (e) {
        console.error('Erro ao carregar funcionários:', e);
        const tbody = document.getElementById('tabela-funcionarios');
        if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:#ef4444;">Erro ao carregar dados: ${e.message}</td></tr>`;
    }
}
