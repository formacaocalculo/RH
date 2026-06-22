// assets/js/modules/login.js
import { auth } from '../app.js';
import {
    signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { confirmarAdminAtual, guardarPerfilProprio } from './tenant.js';

export function render() {
    return `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--rh-primary);font-family:sans-serif;">
        <div style="background:var(--rh-bg-card);border-radius:14px;box-shadow:0 12px 32px rgba(0,0,0,0.18);padding:40px 36px;width:100%;max-width:380px;">
            <div style="text-align:center;margin-bottom:24px;">
                <div style="width:52px;height:52px;border-radius:12px;background:var(--rh-primary-light);display:flex;align-items:center;justify-content:center;margin:0 auto 14px;font-size:24px;">👥</div>
                <h2 style="margin:0;color:var(--rh-text);font-size:20px;">Portal RH</h2>
                <p style="margin:6px 0 0;color:var(--rh-text-subtle);font-size:13px;">Gestão de Recursos Humanos multi-empresa</p>
            </div>

            <div id="tabs-principais" style="display:flex;border-bottom:1px solid var(--rh-border);margin-bottom:20px;">
                <button id="tab-entrar" onclick="window._loginMudarAba('entrar')"
                    style="flex:1;background:none;border:none;padding:10px;cursor:pointer;font-size:13px;font-weight:bold;color:var(--rh-primary);border-bottom:2px solid var(--rh-primary);">
                    Entrar
                </button>
                <button id="tab-registar" onclick="window._loginMudarAba('registar')"
                    style="flex:1;background:none;border:none;padding:10px;cursor:pointer;font-size:13px;font-weight:bold;color:var(--rh-text-subtle);border-bottom:2px solid transparent;">
                    Criar Conta
                </button>
            </div>

            <!-- Formulário: Entrar -->
            <div id="form-entrar">
                <div style="margin-bottom:14px;">
                    <label style="display:block;margin-bottom:5px;font-weight:500;color:var(--rh-text-muted);font-size:12px;">Email</label>
                    <input type="email" id="email" placeholder="email@empresa.pt" autocomplete="email"
                        style="width:100%;padding:11px;border:1px solid var(--rh-border);border-radius:7px;font-size:14px;box-sizing:border-box;">
                </div>
                <div style="margin-bottom:10px;">
                    <label style="display:block;margin-bottom:5px;font-weight:500;color:var(--rh-text-muted);font-size:12px;">Senha</label>
                    <input type="password" id="password" autocomplete="current-password"
                        style="width:100%;padding:11px;border:1px solid var(--rh-border);border-radius:7px;font-size:14px;box-sizing:border-box;">
                </div>
                <div style="text-align:right;margin-bottom:18px;">
                    <a href="#" onclick="window._loginMudarAba('recuperar');return false;" style="font-size:12px;color:var(--rh-primary);text-decoration:none;">
                        Esqueci-me da password
                    </a>
                </div>
                <button id="btn-login"
                    style="width:100%;background:var(--rh-accent);color:var(--rh-text);border:none;padding:13px;border-radius:7px;cursor:pointer;font-weight:bold;font-size:14px;">
                    Entrar
                </button>
            </div>

            <!-- Formulário: Recuperar Password -->
            <div id="form-recuperar" style="display:none;">
                <p style="margin:0 0 16px;font-size:12px;color:var(--rh-text-muted);">
                    Introduza o email da sua conta. Vai receber uma mensagem com um link para definir uma nova password.
                </p>
                <div style="margin-bottom:18px;">
                    <label style="display:block;margin-bottom:5px;font-weight:500;color:var(--rh-text-muted);font-size:12px;">Email</label>
                    <input type="email" id="recuperar-email" placeholder="email@empresa.pt" autocomplete="email"
                        style="width:100%;padding:11px;border:1px solid var(--rh-border);border-radius:7px;font-size:14px;box-sizing:border-box;">
                </div>
                <button id="btn-recuperar"
                    style="width:100%;background:var(--rh-primary);color:#fff;border:none;padding:13px;border-radius:7px;cursor:pointer;font-weight:bold;font-size:14px;">
                    Enviar Link de Recuperação
                </button>
                <p style="text-align:center;margin:14px 0 0;">
                    <a href="#" onclick="window._loginMudarAba('entrar');return false;" style="font-size:12px;color:var(--rh-text-subtle);text-decoration:none;">
                        ← Voltar a Entrar
                    </a>
                </p>
            </div>

            <!-- Formulário: Criar Conta -->
            <div id="form-registar" style="display:none;">
                <div style="margin-bottom:14px;">
                    <label style="display:block;margin-bottom:5px;font-weight:500;color:var(--rh-text-muted);font-size:12px;">Email</label>
                    <input type="email" id="registar-email" placeholder="email@empresa.pt" autocomplete="email"
                        style="width:100%;padding:11px;border:1px solid var(--rh-border);border-radius:7px;font-size:14px;box-sizing:border-box;">
                </div>
                <div style="margin-bottom:14px;">
                    <label style="display:block;margin-bottom:5px;font-weight:500;color:var(--rh-text-muted);font-size:12px;">Senha (mín. 6 caracteres)</label>
                    <input type="password" id="registar-pass" autocomplete="new-password" minlength="6"
                        style="width:100%;padding:11px;border:1px solid var(--rh-border);border-radius:7px;font-size:14px;box-sizing:border-box;">
                </div>
                <div style="margin-bottom:22px;">
                    <label style="display:block;margin-bottom:5px;font-weight:500;color:var(--rh-text-muted);font-size:12px;">Confirmar Senha</label>
                    <input type="password" id="registar-pass2" autocomplete="new-password" minlength="6"
                        style="width:100%;padding:11px;border:1px solid var(--rh-border);border-radius:7px;font-size:14px;box-sizing:border-box;">
                </div>
                <button id="btn-registar"
                    style="width:100%;background:var(--rh-secondary);color:#fff;border:none;padding:13px;border-radius:7px;cursor:pointer;font-weight:bold;font-size:14px;">
                    Criar Conta
                </button>
            </div>

            <p style="margin:18px 0 0;font-size:11px;color:var(--rh-text-subtle);text-align:center;">
                Cada conta gere as suas próprias empresas. Pode criar quantas precisar depois de entrar.
            </p>
        </div>
    </div>
    `;
}

window._loginMudarAba = function(aba) {
    const setAtivo = (idTab, idForm, ativo) => {
        const tab = document.getElementById(idTab);
        if (tab) {
            tab.style.color = ativo ? 'var(--rh-primary)' : 'var(--rh-text-subtle)';
            tab.style.borderBottom = ativo ? '2px solid var(--rh-primary)' : '2px solid transparent';
        }
        document.getElementById(idForm).style.display = ativo ? 'block' : 'none';
    };
    setAtivo('tab-entrar', 'form-entrar', aba === 'entrar');
    setAtivo('tab-registar', 'form-registar', aba === 'registar');
    document.getElementById('form-recuperar').style.display = aba === 'recuperar' ? 'block' : 'none';

    // As duas abas principais (Entrar/Criar Conta) só ficam visíveis quando
    // não estamos no ecrã de recuperação, que é acedido só pelo link.
    document.getElementById('tabs-principais').style.display = aba === 'recuperar' ? 'none' : 'flex';
};

export function init() {
    document.getElementById('btn-login').addEventListener('click', async () => {
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        if (!email || !password) { alert('Introduza email e password.'); return; }
        try {
            await signInWithEmailAndPassword(auth, email, password);
            // Ao logar com sucesso, o 'onAuthStateChanged' em app.js chama
            // window.router.navigateAposLogin(), que decide entre 'empresas'
            // (ainda sem nenhuma escolhida) ou 'dashboard'.
        } catch (error) {
            alert('Erro: ' + error.message);
        }
    });

    document.getElementById('password').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('btn-login').click();
    });

    document.getElementById('btn-registar').addEventListener('click', async () => {
        const email = document.getElementById('registar-email').value.trim();
        const pass = document.getElementById('registar-pass').value;
        const pass2 = document.getElementById('registar-pass2').value;

        if (!email || !pass) { alert('Introduza email e password.'); return; }
        if (pass.length < 6) { alert('A password deve ter pelo menos 6 caracteres.'); return; }
        if (pass !== pass2) { alert('As passwords não coincidem.'); return; }

        // A criação de contas é reservada a administradores. Pedimos as
        // credenciais de um admin e só depois criamos a conta nova.
        const cred = await pedirCredenciaisAdmin();
        if (!cred) return; // cancelado

        await criarContaComoAdmin({
            novoEmail: email, novaPass: pass,
            adminEmail: cred.email, adminPass: cred.password
        });
    });

    document.getElementById('btn-recuperar').addEventListener('click', async () => {
        const email = document.getElementById('recuperar-email').value.trim();
        if (!email) { alert('Introduza o email da sua conta.'); return; }

        const btn = document.getElementById('btn-recuperar');
        btn.disabled = true;
        btn.textContent = 'A enviar…';
        try {
            await sendPasswordResetEmail(auth, email);
            alert('Se existir uma conta com este email, vai receber uma mensagem com um link para definir uma nova password. Verifique também a pasta de spam.');
            window._loginMudarAba('entrar');
        } catch (error) {
            // Por segurança, não revelamos se o email existe ou não — mesma
            // mensagem genérica também em caso de erro inesperado.
            alert('Se existir uma conta com este email, vai receber uma mensagem com um link para definir uma nova password.');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Enviar Link de Recuperação';
        }
    });
}

// ─── Criação de contas reservada a administradores ──────────────────────────

// Mostra um modal a pedir email + password de um administrador. Resolve com
// { email, password } se confirmado, ou null se cancelado.
function pedirCredenciaisAdmin() {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.style.cssText = `position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:9999;
            display:flex;align-items:center;justify-content:center;font-family:sans-serif;`;
        overlay.innerHTML = `
            <div style="background:var(--rh-bg-card);border-radius:12px;padding:26px;width:100%;max-width:380px;box-shadow:0 12px 32px rgba(0,0,0,0.25);">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
                    <div style="width:38px;height:38px;border-radius:9px;background:var(--rh-primary-light);display:flex;align-items:center;justify-content:center;font-size:18px;">🔒</div>
                    <h3 style="margin:0;font-size:16px;color:var(--rh-text);">Autorização de administrador</h3>
                </div>
                <p style="margin:0 0 16px;font-size:13px;color:var(--rh-text-muted);">
                    A criação de contas é reservada a administradores. Introduza as credenciais de um administrador para continuar.
                </p>
                <label style="display:block;margin-bottom:4px;font-size:12px;color:var(--rh-text-muted);">Email do administrador</label>
                <input type="email" id="adm-cred-email" autocomplete="off"
                    style="width:100%;padding:9px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;box-sizing:border-box;margin-bottom:10px;">
                <label style="display:block;margin-bottom:4px;font-size:12px;color:var(--rh-text-muted);">Password do administrador</label>
                <input type="password" id="adm-cred-pass" autocomplete="off"
                    style="width:100%;padding:9px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;box-sizing:border-box;">
                <p id="adm-cred-erro" style="display:none;color:var(--rh-danger);font-size:12px;margin:8px 0 0;"></p>
                <div style="display:flex;gap:8px;margin-top:18px;">
                    <button id="adm-cred-cancelar" style="flex:1;background:var(--rh-bg-muted);color:var(--rh-text-muted);border:1px solid var(--rh-border);padding:10px;border-radius:6px;cursor:pointer;font-size:13px;">Cancelar</button>
                    <button id="adm-cred-ok" style="flex:1;background:var(--rh-primary);color:#fff;border:none;padding:10px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:bold;">Continuar</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);

        const fechar = (valor) => { overlay.remove(); resolve(valor); };
        overlay.querySelector('#adm-cred-cancelar').addEventListener('click', () => fechar(null));
        overlay.addEventListener('click', (e) => { if (e.target === overlay) fechar(null); });
        overlay.querySelector('#adm-cred-ok').addEventListener('click', () => {
            const email = overlay.querySelector('#adm-cred-email').value.trim();
            const password = overlay.querySelector('#adm-cred-pass').value;
            const erro = overlay.querySelector('#adm-cred-erro');
            if (!email || !password) {
                erro.textContent = 'Preencha email e password do administrador.';
                erro.style.display = 'block';
                return;
            }
            fechar({ email, password });
        });
        overlay.querySelector('#adm-cred-pass').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') overlay.querySelector('#adm-cred-ok').click();
        });
        setTimeout(() => overlay.querySelector('#adm-cred-email')?.focus(), 50);
    });
}

// Valida as credenciais de admin e, se forem válidas, cria a conta nova.
// Nota técnica: no Firebase, criar um utilizador no cliente autentica logo
// como esse utilizador. Por isso trocamos de sessão várias vezes (admin →
// conta nova → logout) e suprimimos os redirecionamentos do onAuthStateChanged
// (window._suprimirRedirecionoAuth) para controlar o fluxo manualmente.
async function criarContaComoAdmin({ novoEmail, novaPass, adminEmail, adminPass }) {
    window._suprimirRedirecionoAuth = true;
    try {
        // 1. Validar as credenciais de administrador
        await signInWithEmailAndPassword(auth, adminEmail, adminPass);
        const ehAdmin = await confirmarAdminAtual();
        if (!ehAdmin) {
            await signOut(auth);
            alert('Estas credenciais não pertencem a um administrador. A criação de contas é reservada a administradores.');
            return;
        }

        // 2. Criar a conta nova (passa a estar autenticada como a conta nova)
        await createUserWithEmailAndPassword(auth, novoEmail, novaPass);

        // 3. Gravar o perfil (email) da conta nova para aparecer na Administração
        try { await guardarPerfilProprio(); } catch (e) { /* não crítico */ }

        // 4. Terminar a sessão — quem vai usar a conta fará login depois
        await signOut(auth);

        alert(`Conta "${novoEmail}" criada com sucesso. A pessoa já pode iniciar sessão.`);
        window._loginMudarAba('entrar');
        const emailEl = document.getElementById('email');
        if (emailEl) emailEl.value = novoEmail;
    } catch (error) {
        // Garantir que não fica ninguém autenticado em caso de falha
        try { await signOut(auth); } catch (e) { /* ignore */ }
        const msg = (error && error.code === 'auth/email-already-in-use')
            ? 'Já existe uma conta com esse email.'
            : (error && (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found'))
                ? 'Credenciais de administrador inválidas.'
                : 'Erro ao criar conta: ' + (error?.message || error);
        alert(msg);
    } finally {
        window._suprimirRedirecionoAuth = false;
    }
}
