// assets/js/modules/login.js
import { auth } from '../app.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

export function render() {
    return `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--rh-primary);font-family:sans-serif;">
        <div style="background:var(--rh-bg-card);border-radius:14px;box-shadow:0 12px 32px rgba(0,0,0,0.18);padding:40px 36px;width:100%;max-width:380px;">
            <div style="text-align:center;margin-bottom:28px;">
                <div style="width:52px;height:52px;border-radius:12px;background:var(--rh-primary-light);display:flex;align-items:center;justify-content:center;margin:0 auto 14px;font-size:24px;">👥</div>
                <h2 style="margin:0;color:var(--rh-text);font-size:20px;">Portal RH</h2>
                <p style="margin:6px 0 0;color:var(--rh-text-subtle);font-size:13px;">Inicie sessão para continuar</p>
            </div>

            <div style="margin-bottom:14px;">
                <label style="display:block;margin-bottom:5px;font-weight:500;color:var(--rh-text-muted);font-size:12px;">Email</label>
                <input type="email" id="email" placeholder="email@empresa.pt"
                    style="width:100%;padding:11px;border:1px solid var(--rh-border);border-radius:7px;font-size:14px;box-sizing:border-box;">
            </div>
            <div style="margin-bottom:22px;">
                <label style="display:block;margin-bottom:5px;font-weight:500;color:var(--rh-text-muted);font-size:12px;">Senha</label>
                <input type="password" id="password" placeholder="••••••••"
                    style="width:100%;padding:11px;border:1px solid var(--rh-border);border-radius:7px;font-size:14px;box-sizing:border-box;">
            </div>

            <button id="btn-login"
                style="width:100%;background:var(--rh-accent);color:var(--rh-text);border:none;padding:13px;border-radius:7px;cursor:pointer;font-weight:bold;font-size:14px;">
                Entrar
            </button>
        </div>
    </div>
    `;
}

export function init() {
    document.getElementById('btn-login').addEventListener('click', async () => {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        try {
            await signInWithEmailAndPassword(auth, email, password);
            // Ao logar com sucesso, o 'onAuthStateChanged' no app.js 
            // vai automaticamente redirecionar para o 'dashboard'
        } catch (error) {
            alert("Erro: " + error.message);
        }
    });

    document.getElementById('password').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('btn-login').click();
    });
}
