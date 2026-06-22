// assets/js/modules/admin.js
// Área exclusiva de quem tem um documento em admins/{uid}. Mostra todas as
// empresas de todos os utilizadores (collection-group query) e permite
// "entrar" numa delas para dar suporte, sem nunca precisar das credenciais
// de mais ninguém. Também gere a lixeira de empresas eliminadas.

import {
    isAdmin, listarTodasEmpresasAdmin, entrarNaEmpresa, moverEmpresa,
    listarLixeiraEmpresas, restaurarEmpresaDaLixeira, eliminarDaLixeiraDefinitivo
} from './tenant.js';
import { pedirReautenticacao } from './seguranca-dados.js';
import { auth } from '../app.js';
import { esc, escAttr } from './html-utils.js';

let S = { empresas: [], lixeira: [], abaAtiva: 'empresas' };

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
        </main>
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
            <td style="padding:11px 16px;font-weight:500;">${esc(e.nome)}</td>
            <td style="padding:11px 16px;font-family:monospace;font-size:12px;color:var(--rh-text-muted);">${esc(e.nif) || '—'}</td>
            <td style="padding:11px 16px;font-family:monospace;font-size:11px;color:var(--rh-text-subtle);" title="${esc(e.donoUid)}">${esc((e.donoUid || '').slice(0, 12))}…</td>
            <td style="padding:11px 16px;color:var(--rh-text-muted);">${formatarData(e.criadoEm)}</td>
            <td style="padding:11px 16px;text-align:right;white-space:nowrap;">
                <button onclick="window._adminMover('${escAttr(e.id)}','${escAttr(e.donoUid)}')"
                    style="background:var(--rh-bg-muted);color:var(--rh-text);border:1px solid var(--rh-border);padding:7px 12px;border-radius:6px;cursor:pointer;font-size:12px;margin-right:6px;">
                    ⇄ Mover
                </button>
                <button onclick="window._adminEntrar('${escAttr(e.id)}','${escAttr(e.donoUid)}')"
                    style="background:var(--rh-accent);color:var(--rh-text);border:none;padding:7px 14px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:bold;">
                    Entrar →
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
            <td style="padding:11px 16px;font-weight:500;">${esc(item.empresa?.nome) || '—'}</td>
            <td style="padding:11px 16px;font-family:monospace;font-size:12px;color:var(--rh-text-muted);">${esc(item.empresa?.nif) || '—'}</td>
            <td style="padding:11px 16px;font-family:monospace;font-size:11px;color:var(--rh-text-subtle);" title="${esc(item.donoUid)}">${esc((item.donoUid || '').slice(0, 12))}…</td>
            <td style="padding:11px 16px;color:var(--rh-text-muted);">${formatarData(item.eliminadaEm)}</td>
            <td style="padding:11px 16px;text-align:right;white-space:nowrap;">
                <button onclick="window._adminRestaurar('${escAttr(item.id)}')"
                    style="background:var(--rh-bg-muted);border:1px solid var(--rh-border);padding:7px 12px;border-radius:6px;cursor:pointer;font-size:12px;margin-right:6px;">
                    ↺ Restaurar
                </button>
                <button onclick="window._adminApagarDefinitivo('${escAttr(item.id)}')"
                    style="background:var(--rh-danger-bg);color:var(--rh-danger-text);border:1px solid var(--rh-danger);padding:7px 12px;border-radius:6px;cursor:pointer;font-size:12px;">
                    ✕ Apagar definitivo
                </button>
            </td>
        </tr>`).join('');
}

// ─── Ações ────────────────────────────────────────────────────────────────────
window._adminMudarAba = function(aba) {
    S.abaAtiva = aba;
    document.getElementById('painel-empresas').style.display = aba === 'empresas' ? 'block' : 'none';
    document.getElementById('painel-lixeira').style.display = aba === 'lixeira' ? 'block' : 'none';

    const setAtivo = (id, ativo) => {
        const el = document.getElementById(id);
        el.style.color = ativo ? 'var(--rh-primary)' : 'var(--rh-text-subtle)';
        el.style.borderBottom = ativo ? '2px solid var(--rh-primary)' : '2px solid transparent';
    };
    setAtivo('tab-empresas', aba === 'empresas');
    setAtivo('tab-lixeira', aba === 'lixeira');
};

window._adminEntrar = async function(empresaId, donoUid) {
    await entrarNaEmpresa(empresaId, donoUid);
    window.router.navigate('dashboard');
};

// ─── Mover empresa entre utilizadores ──────────────────────────────────────
// Abre um modal para escolher o utilizador de destino. Os candidatos são os
// donos já conhecidos (das empresas listadas) mais o próprio admin; também
// permite colar manualmente um UID (ex.: mover para um utilizador que ainda
// não tem nenhuma empresa).
window._adminMover = function(empresaId, donoUid) {
    const empresa = S.empresas.find(e => e.id === empresaId && e.donoUid === donoUid);
    const nomeEmpresa = empresa?.nome || empresaId;
    const meuUid = auth.currentUser?.uid || '';

    // Lista de UIDs candidatos (distintos, exceto o dono atual)
    const candidatos = [...new Set(S.empresas.map(e => e.donoUid))].filter(u => u && u !== donoUid);
    if (meuUid && meuUid !== donoUid && !candidatos.includes(meuUid)) candidatos.unshift(meuUid);

    const opcoes = candidatos.map(u =>
        `<option value="${escAttr(u)}">${esc(u.slice(0, 16))}…${u === meuUid ? '  (eu)' : ''}</option>`
    ).join('');

    const overlay = document.createElement('div');
    overlay.style.cssText = `position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:9999;
        display:flex;align-items:center;justify-content:center;font-family:sans-serif;`;
    overlay.innerHTML = `
        <div style="background:var(--rh-bg-card);border-radius:12px;padding:26px;width:100%;max-width:440px;box-shadow:0 12px 32px rgba(0,0,0,0.25);">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
                <div style="width:38px;height:38px;border-radius:9px;background:var(--rh-primary-soft);display:flex;align-items:center;justify-content:center;font-size:18px;">⇄</div>
                <h3 style="margin:0;font-size:16px;color:var(--rh-text);">Mover Empresa</h3>
            </div>
            <p style="margin:0 0 16px;font-size:13px;color:var(--rh-text-muted);">
                A empresa <strong>${esc(nomeEmpresa)}</strong> e todos os seus dados (colaboradores,
                ausências, processamentos, configurações) serão transferidos para a conta escolhida.
                O dono atual deixa de ter acesso.
            </p>
            <div style="margin-bottom:10px;">
                <label style="display:block;margin-bottom:4px;font-size:12px;color:var(--rh-text-muted);">Utilizador de destino</label>
                <select id="adm-mover-sel" style="width:100%;padding:9px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;background:var(--rh-bg-card);">
                    ${opcoes || '<option value="">(sem outros utilizadores conhecidos)</option>'}
                </select>
            </div>
            <div style="margin-bottom:8px;">
                <label style="display:block;margin-bottom:4px;font-size:12px;color:var(--rh-text-muted);">… ou colar um UID manualmente (tem prioridade se preenchido)</label>
                <input type="text" id="adm-mover-uid" placeholder="UID do utilizador de destino"
                    style="width:100%;padding:9px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;box-sizing:border-box;font-family:monospace;">
            </div>
            <p id="adm-mover-erro" style="display:none;color:var(--rh-danger);font-size:12px;margin:4px 0 10px;"></p>
            <div style="display:flex;gap:8px;margin-top:16px;">
                <button id="adm-mover-cancelar" style="flex:1;background:var(--rh-bg-muted);color:var(--rh-text-muted);border:1px solid var(--rh-border);padding:10px;border-radius:6px;cursor:pointer;font-size:13px;">Cancelar</button>
                <button id="adm-mover-confirmar" style="flex:1;background:var(--rh-primary);color:#fff;border:none;padding:10px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:bold;">Mover empresa</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    const fechar = () => overlay.remove();
    const erroEl = overlay.querySelector('#adm-mover-erro');
    overlay.querySelector('#adm-mover-cancelar').addEventListener('click', fechar);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) fechar(); });

    overlay.querySelector('#adm-mover-confirmar').addEventListener('click', async () => {
        const manual = overlay.querySelector('#adm-mover-uid').value.trim();
        const destino = manual || overlay.querySelector('#adm-mover-sel').value;
        if (!destino) {
            erroEl.textContent = 'Escolha ou cole um UID de destino.';
            erroEl.style.display = 'block';
            return;
        }
        if (destino === donoUid) {
            erroEl.textContent = 'A empresa já pertence a esse utilizador.';
            erroEl.style.display = 'block';
            return;
        }

        // Mover transfere uma empresa inteira entre contas: confirmar identidade.
        const ok = await pedirReautenticacao(
            `Vai mover a empresa "${nomeEmpresa}" para outro utilizador. Introduza a sua password para confirmar.`
        );
        if (!ok) return;

        const btn = overlay.querySelector('#adm-mover-confirmar');
        btn.disabled = true; btn.textContent = 'A mover…';
        try {
            await moverEmpresa(empresaId, donoUid, destino);
            fechar();
            alert(`Empresa "${nomeEmpresa}" movida com sucesso.`);
            await carregarTudo();
        } catch (e) {
            erroEl.textContent = 'Erro ao mover: ' + e.message;
            erroEl.style.display = 'block';
            btn.disabled = false; btn.textContent = 'Mover empresa';
        }
    });
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
    const erros = [];
    try {
        S.empresas = await listarTodasEmpresasAdmin();
    } catch (e) {
        S.empresas = [];
        console.error('[admin] listarTodasEmpresasAdmin falhou:', e);
        erros.push('Empresas: ' + (e?.message || e));
    }
    try {
        S.lixeira = await listarLixeiraEmpresas();
    } catch (e) {
        S.lixeira = [];
        console.error('[admin] listarLixeiraEmpresas falhou:', e);
        erros.push('Lixeira: ' + (e?.message || e));
    }

    await carregarStats();
    window._adminRenderEmpresas();
    renderLixeira();

    if (erros.length) mostrarErroAdmin(erros.join('\n'));
    else { const b = document.getElementById('adm-erro'); if (b) b.remove(); }
}

// Mostra um aviso visível (em vez de deixar o erro chegar ao router, que
// mostraria "Página não encontrada"). Inclui a mensagem real do Firestore —
// se mencionar um índice/permissão, o link de criação costuma vir aí ou na
// consola do browser (F12 → Console).
function mostrarErroAdmin(msg) {
    let banner = document.getElementById('adm-erro');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'adm-erro';
        banner.style.cssText = 'background:var(--rh-danger-bg);border:1px solid var(--rh-danger);' +
            'color:var(--rh-danger-text);border-radius:8px;padding:14px 16px;margin-bottom:18px;font-size:13px;';
        const statsEl = document.getElementById('adm-stats');
        if (statsEl && statsEl.parentNode) statsEl.parentNode.insertBefore(banner, statsEl);
        else (document.querySelector('main') || document.getElementById('app')).prepend(banner);
    }
    banner.innerHTML = `
        <strong>⚠️ Não foi possível carregar todos os dados de administração.</strong>
        <div style="margin-top:6px;white-space:pre-wrap;font-family:monospace;font-size:12px;word-break:break-word;">${esc(msg)}</div>
        <button onclick="window._adminRecarregar()"
            style="margin-top:10px;background:var(--rh-danger);color:#fff;border:none;padding:7px 14px;border-radius:6px;cursor:pointer;font-size:12px;">
            Tentar novamente
        </button>
        <p style="margin:8px 0 0;color:var(--rh-text-muted);font-size:12px;">
            Causa habitual: as regras do Firestore não permitem a consulta de grupo às empresas. Confirme que publicou as
            regras atualizadas (com a regra <code>match /{caminho=**}/empresas/{empresaId}</code>). Se o erro mencionar um
            índice, abra o link indicado na consola do browser para o criar.
        </p>`;
}

window._adminRecarregar = async function() {
    await carregarTudo();
};

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
    // carregarTudo já trata os próprios erros internamente, por isso o init
    // nunca rebenta para o router (evita o "Página não encontrada").
    await carregarTudo();
}
