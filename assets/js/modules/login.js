// assets/js/modules/login.js
import { auth } from '../app.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

export function render() {
    return `
    <div class="login-box">
        <h2>Login</h2>
        <input type="email" id="email" placeholder="Email">
        <input type="password" id="password" placeholder="Senha">
        <button id="btn-login">Entrar</button>
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
}
