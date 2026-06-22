// assets/js/modules/admin.js
// Área exclusiva de quem tem um documento em admins/{uid}. Mostra todas as
// empresas de todos os utilizadores (collection-group query) e permite
// "entrar" numa delas para dar suporte, sem nunca precisar das credenciais
// de mais ninguém. Também gere a lixeira de empresas eliminadas.

import {
    isAdmin, listarTodasEmpresasAdmin, entrarNaEmpresa,
    listarLixeiraEmpresas, restaurarEmpresaDaLixeira, eliminarDaLixeiraDefinitivo,
    transferirEmpresa, listarUtilizadores, eliminarUtilizador
} from './tenant.js';
import { auth } from '../app.js';

let S = { empresas: [], lixeira: [], utilizadores: [], abaAtiva: 'empresas', transfEmpresa: null };

// ─── render() ───────────────────────────────────────────────────────────────
export function render() {
    return `
    <div style="min-height:100vh;background:var(--rh-bg);font-family:sans-serif;">
        <header style="background:var(--rh-primary);color:var(--rh-bg-card);padding:20px 32px;display:flex;justify-content:space-between;align-items:center;">
            <div style="display:flex;align-items:center;gap:12px;">
                <div style="background:var(--rh-primary-light);padding:8px;border-radius:8px;">🛠️</div>
                <div>
                    <h3 style="margin:0;font-size:16px;">Administração</h3>
                    <small style="color:var(--rh-text-subtle);">Visão global — todos os utilizadores</small>
                </div>
            </div>
            <div style="display:flex;gap:10px;">
                <button onclick="window.router.navigate('empresas')"
                    style="background:var(--rh-bg-muted);color:var(--rh-text);border:1px solid rgba(255,255,255,0.3);padding:8px 14px;border-radius:6px;cursor:pointer;font-size:12px;">
                    ← Voltar às Minhas Empresas
                </button>
            </div>
        </header>

        <main style="max-width:1100px;margin:0 auto;padding:32px 24px;">
            <div id="adm-stats" style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:26px;"></div>

            <div style="display:flex;gap:8px;margin-bottom:18px;border-bottom:2px solid var(--rh-border);">
                <button id="tab-empresas" onclick="window._adminMudarAba('empresas')"
                    style="background:none;border:none;padding:10px 16px;cursor:pointer;font-size:13px;font-weight:bold;color:var(--rh-primary);border-bottom:2px solid var(--rh-primary);margin-bottom:-2px;">
                    Todas as Empresas
                </button>
                <button id="tab-lixeira" onclick="window._adminMudarAba('lixeira')"
                    style="background:none;border:none;padding:10px 16px;cursor:pointer;font-size:13px;font-weight:bold;color:var(--rh-text-subtle);border-bottom:2px solid transparent;margin-bottom:-2px;">
                    Lixeira (Empresas Eliminadas)
                </button>
                <button id="tab-utilizadores" onclick="window._adminMudarAba('utilizadores')"
                    style="background:none;border:none;padding:10px 16px;cursor:pointer;font-size:13px;font-weight:bold;color:var(--rh-text-subtle);border-bottom:2px solid transparent;margin-bottom:-2px;">
                    Utilizadores
                </button>
            </div>

            <div id="painel-empresas">
                <input type="text" id="adm-filtro" placeholder="🔎 Pesquisar por nome, NIF ou utilizador (uid)…"
                    oninput="window._adminRenderEmpresas()"
                    style="width:100%;padding:10px 14px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;box-sizing:border-box;margin-bottom:16px;">
                <div style="background:var(--rh-bg-card);border-radius:10px;overflow:hidden;box-shadow:0 2px 4px rgba(0,0,0,0.03);">
                    <table style="width:100%;border-collapse:collapse;font-size:13px;">
                        <thead>
                            <tr style="background:var(--rh-bg-muted);text-align:left;">
                                <th style="padding:11px 16px;">Empresa</th>
                                <th style="padding:11px 16px;">NIF</th>
                                <th style="padding:11px 16px;">Dono (uid)</th>
                                <th style="padding:11px 16px;">Criada em</th>
                                <th style="padding:11px 16px;"></th>
                            </tr>
                        </thead>
                        <tbody id="tbody-adm-empresas"></tbody>
                    </table>
                    <p id="adm-sem-empresas" style="display:none;text-align:center;color:var(--rh-text-subtle);padding:30px;font-style:italic;">Nenhuma empresa registada.</p>
                </div>
            </div>

            <div id="painel-lixeira" style="display:none;">
                <div style="background:var(--rh-warning-bg);border:1px solid var(--rh-warning);border-radius:8px;padding:12px 16px;margin-bottom:16px;font-size:13px;color:var(--rh-warning-text);">
                    ⚠️ Empresas eliminadas ficam guardadas aqui antes de serem apagadas em definitivo. Pode restaurá-las para o utilizador original, ou eliminá-las de forma permanente.
                </div>
                <div style="background:var(--rh-bg-card);border-radius:10px;overflow:hidden;box-shadow:0 2px 4px rgba(0,0,0,0.03);">
                    <table style="width:100%;border-collapse:collapse;font-size:13px;">
                        <thead>
                            <tr style="background:var(--rh-bg-muted);text-align:left;">
                                <th style="padding:11px 16px;">Empresa</th>
                                <th style="padding:11px 16px;">NIF</th>
                                <th style="padding:11px 16px;">Dono original (uid)</th>
                                <th style="padding:11px 16px;">Eliminada em</th>
                                <th style="padding:11px 16px;"></th>
                            </tr>
                        </thead>
                        <tbody id="tbody-lixeira"></tbody>
                    </table>
                    <p id="adm-sem-lixeira" style="display:none;text-align:center;color:var(--rh-text-subtle);padding:30px;font-style:italic;">Lixeira vazia.</p>
                </div>
            </div>

            <div id="painel-utilizadores" style="display:none;">
                <div style="background:var(--rh-warning-bg);border:1px solid var(--rh-warning);border-radius:8px;padding:12px 16px;margin-bottom:16px;font-size:13px;color:var(--rh-warning-text);">
                    ⚠️ Eliminar um utilizador apaga <strong>todos os dados dele</strong> (empresas, colaboradores, tudo) de forma permanente. A conta de login (email/password) <strong>não</strong> é removida por aqui — isso tem de ser feito na consola do Firebase (Authentication → Users → Eliminar).
                </div>
                <div style="background:var(--rh-bg-card);border-radius:10px;overflow:hidden;box-shadow:0 2px 4px rgba(0,0,0,0.03);">
                    <table style="width:100%;border-collapse:collapse;font-size:13px;">
                        <thead>
                            <tr style="background:var(--rh-bg-muted);text-align:left;">
                                <th style="padding:11px 16px;">Email</th>
                                <th style="padding:11px 16px;">UID</th>
                                <th style="padding:11px 16px;">Empresas</th>
                                <th style="padding:11px 16px;"></th>
                            </tr>
                        </thead>
                        <tbody id="tbody-utilizadores"></tbody>
                    </table>
                    <p id="adm-sem-utilizadores" style="display:none;text-align:center;color:var(--rh-text-subtle);padding:30px;font-style:italic;">Nenhum utilizador registado.</p>
                </div>
            </div>
        </main>

        <!-- Janela de transferência de empresa -->
        <div id="modal-transferir" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:1000;align-items:center;justify-content:center;">
            <div style="background:var(--rh-bg-card);border-radius:12px;padding:26px;width:90%;max-width:440px;box-shadow:0 16px 40px rgba(0,0,0,0.3);">
                <h3 style="margin:0 0 6px;font-size:17px;color:var(--rh-primary);">⇄ Transferir empresa</h3>
                <p id="transf-info" style="margin:0 0 18px;font-size:13px;color:var(--rh-text-muted);"></p>
                <label style="display:block;margin-bottom:6px;font-size:12px;color:var(--rh-text-muted);font-weight:bold;">Transferir para o utilizador:</label>
                <select id="transf-destino" style="width:100%;padding:10px;border:1px solid var(--rh-border);border-radius:7px;font-size:13px;box-sizing:border-box;margin-bottom:20px;"></select>
                <div style="display:flex;gap:10px;justify-content:flex-end;">
                    <button onclick="window._adminFecharTransferir()"
                        style="background:var(--rh-bg-muted);color:var(--rh-text-muted);border:1px solid var(--rh-border);padding:9px 16px;border-radius:6px;cursor:pointer;font-size:13px;">
                        Cancelar
                    </button>
                    <button onclick="window._adminConfirmarTransferencia()"
                        style="background:var(--rh-secondary);color:#fff;border:none;padding:9px 16px;border-radius:6px;cursor:pointer;font-weight:bold;font-size:13px;">
                        Transferir
                    </button>
                </div>
            </div>
        </div>
    </div>`;
}

// ─── Carregamento ─────────────────────────────────────────────────────────────
async function carregarStats() {
    const utilizadores = new Set(S.empresas.map(e => e.donoUid)).size;
    document.getElementById('adm-stats').innerHTML = `
        <div style="background:var(--rh-bg-card);padding:18px;border-radius:10px;border-top:4px solid var(--rh-primary);">
            <small style="color:var(--rh-text-muted);text-transform:uppercase;font-size:11px;font-weight:bold;">Total de Empresas</small>
            <h3 style="margin:8px 0 2px;font-size:24px;color:var(--rh-primary);">${S.empresas.length}</h3>
        </div>
        <div style="background:var(--rh-bg-card);padding:18px;border-radius:10px;border-top:4px solid var(--rh-secondary);">
            <small style="color:var(--rh-text-muted);text-transform:uppercase;font-size:11px;font-weight:bold;">Utilizadores com Empresas</small>
            <h3 style="margin:8px 0 2px;font-size:24px;color:var(--rh-primary);">${utilizadores}</h3>
        </div>
        <div style="background:var(--rh-bg-card);padding:18px;border-radius:10px;border-top:4px solid var(--rh-danger);">
            <small style="color:var(--rh-text-muted);text-transform:uppercase;font-size:11px;font-weight:bold;">Na Lixeira</small>
            <h3 style="margin:8px 0 2px;font-size:24px;color:var(--rh-primary);">${S.lixeira.length}</h3>
        </div>`;
}

function formatarData(iso) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('pt-PT'); } catch { return iso; }
}

window._adminRenderEmpresas = function() {
    const filtro = (document.getElementById('adm-filtro')?.value || '').toLowerCase().trim();
    let lista = S.empresas;
    if (filtro) {
        lista = lista.filter(e =>
            (e.nome || '').toLowerCase().includes(filtro) ||
            (e.nif || '').toLowerCase().includes(filtro) ||
            (e.donoUid || '').toLowerCase().includes(filtro)
        );
    }
    const tbody = document.getElementById('tbody-adm-empresas');
    const semEl = document.getElementById('adm-sem-empresas');
    if (!lista.length) { tbody.innerHTML = ''; semEl.style.display = 'block'; return; }
    semEl.style.display = 'none';

    tbody.innerHTML = lista.map(e => `
        <tr style="border-top:1px solid var(--rh-border);">
            <td style="padding:11px 16px;font-weight:500;">${e.nome}</td>
            <td style="padding:11px 16px;font-family:monospace;font-size:12px;color:var(--rh-text-muted);">${e.nif || '—'}</td>
            <td style="padding:11px 16px;font-family:monospace;font-size:11px;color:var(--rh-text-subtle);" title="${e.donoUid}">${e.donoUid.slice(0, 12)}…</td>
            <td style="padding:11px 16px;color:var(--rh-text-muted);">${formatarData(e.criadoEm)}</td>
            <td style="padding:11px 16px;text-align:right;white-space:nowrap;">
                <button onclick="window._adminEntrar('${e.id}','${e.donoUid}')"
                    style="background:var(--rh-accent);color:var(--rh-text);border:none;padding:7px 14px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:bold;margin-right:6px;">
                    Entrar →
                </button>
                <button onclick="window._adminAbrirTransferir('${e.id}','${e.donoUid}')"
                    style="background:var(--rh-bg-muted);border:1px solid var(--rh-border);padding:7px 12px;border-radius:6px;cursor:pointer;font-size:12px;">
                    ⇄ Transferir
                </button>
            </td>
        </tr>`).join('');
};

function renderLixeira() {
    const tbody = document.getElementById('tbody-lixeira');
    const semEl = document.getElementById('adm-sem-lixeira');
    if (!S.lixeira.length) { tbody.innerHTML = ''; semEl.style.display = 'block'; return; }
    semEl.style.display = 'none';

    tbody.innerHTML = S.lixeira.map(item => `
        <tr style="border-top:1px solid var(--rh-border);">
            <td style="padding:11px 16px;font-weight:500;">${item.empresa?.nome || '—'}</td>
            <td style="padding:11px 16px;font-family:monospace;font-size:12px;color:var(--rh-text-muted);">${item.empresa?.nif || '—'}</td>
            <td style="padding:11px 16px;font-family:monospace;font-size:11px;color:var(--rh-text-subtle);" title="${item.donoUid}">${(item.donoUid || '').slice(0, 12)}…</td>
            <td style="padding:11px 16px;color:var(--rh-text-muted);">${formatarData(item.eliminadaEm)}</td>
            <td style="padding:11px 16px;text-align:right;white-space:nowrap;">
                <button onclick="window._adminRestaurar('${item.id}')"
                    style="background:var(--rh-bg-muted);border:1px solid var(--rh-border);padding:7px 12px;border-radius:6px;cursor:pointer;font-size:12px;margin-right:6px;">
                    ↺ Restaurar
                </button>
                <button onclick="window._adminApagarDefinitivo('${item.id}')"
                    style="background:var(--rh-danger-bg);color:var(--rh-danger-text);border:1px solid var(--rh-danger);padding:7px 12px;border-radius:6px;cursor:pointer;font-size:12px;">
                    ✕ Apagar definitivo
                </button>
            </td>
        </tr>`).join('');
}

// Lista combinada de utilizadores: os do registo (utilizadores/{uid} com
// email) mais quaisquer donos de empresas que ainda não tenham registo.
function utilizadoresCombinados() {
    const map = new Map();
    S.utilizadores.forEach(u => map.set(u.uid, { uid: u.uid, email: u.email || '' }));
    S.empresas.forEach(e => {
        if (!map.has(e.donoUid)) map.set(e.donoUid, { uid: e.donoUid, email: '' });
    });
    return [...map.values()].map(u => ({
        ...u,
        nEmpresas: S.empresas.filter(e => e.donoUid === u.uid).length,
    })).sort((a, b) => (a.email || a.uid).localeCompare(b.email || b.uid));
}

function renderUtilizadores() {
    const tbody = document.getElementById('tbody-utilizadores');
    const semEl = document.getElementById('adm-sem-utilizadores');
    if (!tbody) return;
    const lista = utilizadoresCombinados();
    if (!lista.length) { tbody.innerHTML = ''; semEl.style.display = 'block'; return; }
    semEl.style.display = 'none';

    const meuUid = auth.currentUser?.uid;
    tbody.innerHTML = lista.map(u => {
        const souEu = u.uid === meuUid;
        return `
        <tr style="border-top:1px solid var(--rh-border);">
            <td style="padding:11px 16px;font-weight:500;">${u.email || '<span style="color:var(--rh-text-subtle);font-style:italic;">(sem email registado)</span>'}${souEu ? ' <span style="font-size:11px;color:var(--rh-accent);">(você)</span>' : ''}</td>
            <td style="padding:11px 16px;font-family:monospace;font-size:11px;color:var(--rh-text-subtle);" title="${u.uid}">${u.uid.slice(0, 14)}…</td>
            <td style="padding:11px 16px;color:var(--rh-text-muted);">${u.nEmpresas}</td>
            <td style="padding:11px 16px;text-align:right;">
                ${souEu ? '<span style="font-size:12px;color:var(--rh-text-subtle);">—</span>' : `
                <button onclick="window._adminEliminarUtilizador('${u.uid}','${(u.email || '').replace(/'/g, '')}')"
                    style="background:var(--rh-danger-bg);color:var(--rh-danger-text);border:1px solid var(--rh-danger);padding:7px 12px;border-radius:6px;cursor:pointer;font-size:12px;">
                    🗑️ Eliminar dados
                </button>`}
            </td>
        </tr>`;
    }).join('');
}

// ─── Ações ────────────────────────────────────────────────────────────────────
window._adminMudarAba = function(aba) {
    S.abaAtiva = aba;
    document.getElementById('painel-empresas').style.display = aba === 'empresas' ? 'block' : 'none';
    document.getElementById('painel-lixeira').style.display = aba === 'lixeira' ? 'block' : 'none';
    document.getElementById('painel-utilizadores').style.display = aba === 'utilizadores' ? 'block' : 'none';

    const setAtivo = (id, ativo) => {
        const el = document.getElementById(id);
        el.style.color = ativo ? 'var(--rh-primary)' : 'var(--rh-text-subtle)';
        el.style.borderBottom = ativo ? '2px solid var(--rh-primary)' : '2px solid transparent';
    };
    setAtivo('tab-empresas', aba === 'empresas');
    setAtivo('tab-lixeira', aba === 'lixeira');
    setAtivo('tab-utilizadores', aba === 'utilizadores');
};

window._adminEntrar = async function(empresaId, donoUid) {
    await entrarNaEmpresa(empresaId, donoUid);
    window.router.navigate('dashboard');
};

// ── Transferência de empresa ──
window._adminAbrirTransferir = function(empresaId, donoUid) {
    const emp = S.empresas.find(e => e.id === empresaId && e.donoUid === donoUid);
    if (!emp) return;
    S.transfEmpresa = { id: empresaId, donoUid };

    // Opções de destino: todos os utilizadores conhecidos, menos o dono atual.
    const destinos = utilizadoresCombinados().filter(u => u.uid !== donoUid);
    const sel = document.getElementById('transf-destino');
    if (!destinos.length) {
        sel.innerHTML = '<option value="">(não há outros utilizadores)</option>';
    } else {
        sel.innerHTML = destinos.map(u =>
            `<option value="${u.uid}">${u.email || '(sem email)'} — ${u.uid.slice(0, 10)}…</option>`
        ).join('');
    }

    document.getElementById('transf-info').textContent =
        `A empresa "${emp.nome}" vai passar a pertencer ao utilizador escolhido, com todos os seus dados.`;
    document.getElementById('modal-transferir').style.display = 'flex';
};

window._adminFecharTransferir = function() {
    document.getElementById('modal-transferir').style.display = 'none';
    S.transfEmpresa = null;
};

window._adminConfirmarTransferencia = async function() {
    if (!S.transfEmpresa) return;
    const uidDestino = document.getElementById('transf-destino').value;
    if (!uidDestino) { alert('Escolha um utilizador de destino.'); return; }

    try {
        await transferirEmpresa(S.transfEmpresa.id, S.transfEmpresa.donoUid, uidDestino);
        window._adminFecharTransferir();
        alert('Empresa transferida com sucesso.');
        await carregarTudo();
    } catch (e) {
        alert('Erro ao transferir: ' + e.message);
    }
};

// ── Eliminar utilizador (apaga os dados; não a conta de login) ──
window._adminEliminarUtilizador = async function(uid, email) {
    if (uid === auth.currentUser?.uid) { alert('Não pode eliminar a sua própria conta por aqui.'); return; }

    const etiqueta = email || uid;
    const confirmacao = prompt(
        `Vai eliminar PERMANENTEMENTE todos os dados de "${etiqueta}" (todas as empresas e respetivos dados).\n\n` +
        `A conta de login NÃO é removida por aqui (faz-se na consola do Firebase).\n\n` +
        `Para confirmar, escreva ELIMINAR em maiúsculas:`
    );
    if (confirmacao !== 'ELIMINAR') { if (confirmacao !== null) alert('Confirmação incorreta. Nada foi eliminado.'); return; }

    try {
        const n = await eliminarUtilizador(uid);
        alert(`Dados eliminados: ${n} empresa(s) removida(s).\n\nLembrete: para apagar também o login, vá a Authentication → Users na consola do Firebase.`);
        await carregarTudo();
    } catch (e) {
        alert('Erro ao eliminar utilizador: ' + e.message);
    }
};

window._adminRestaurar = async function(empresaId) {
    if (!confirm('Restaurar esta empresa para o utilizador original?')) return;
    try {
        const resultado = await restaurarEmpresaDaLixeira(empresaId);
        if (resultado) {
            alert(`Empresa "${resultado.nome}" restaurada com sucesso.`);
            await carregarTudo();
        } else {
            alert('Não foi possível restaurar — backup não encontrado.');
        }
    } catch (e) {
        alert('Erro ao restaurar: ' + e.message);
    }
};

window._adminApagarDefinitivo = async function(empresaId) {
    if (!confirm('Apagar este backup PERMANENTEMENTE? Esta ação não pode ser revertida.')) return;
    try {
        await eliminarDaLixeiraDefinitivo(empresaId);
        await carregarTudo();
    } catch (e) {
        alert('Erro ao apagar: ' + e.message);
    }
};

async function carregarTudo() {
    [S.empresas, S.lixeira, S.utilizadores] = await Promise.all([
        listarTodasEmpresasAdmin(), listarLixeiraEmpresas(), listarUtilizadores()
    ]);
    await carregarStats();
    window._adminRenderEmpresas();
    renderLixeira();
    renderUtilizadores();
}

// ─── init() ───────────────────────────────────────────────────────────────────
export async function init() {
    const admin = await isAdmin();
    if (!admin) {
        document.getElementById('app').innerHTML = `
            <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:var(--rh-bg);font-family:sans-serif;">
                <div style="text-align:center;">
                    <h2 style="color:var(--rh-danger);margin-bottom:10px;">Acesso Restrito</h2>
                    <p style="color:var(--rh-text-muted);margin-bottom:20px;">Esta área é exclusiva a administradores.</p>
                    <button onclick="window.router.navigate('empresas')"
                        style="background:var(--rh-accent);color:var(--rh-text);border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-weight:bold;">
                        ← Voltar
                    </button>
                </div>
            </div>`;
        return;
    }

    S.abaAtiva = 'empresas';
    await carregarTudo();
}
