// assets/js/app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js?v=2';
//import { firebaseConfig } from './firebase-config.js';

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Promise que resolve na primeira vez que o Firebase Auth informa o estado
// real da sessão (autenticado ou não). Outros módulos devem "await authReady"
// antes de confiar em auth.currentUser ou de fazer pedidos ao Firestore —
// o SDK demora um instante a restaurar a sessão a partir do armazenamento
// local, e sem esperar por isto um refresh de página poderia, por engano,
// tratar um utilizador autenticado como se não estivesse logado.
let _resolverAuthReady;
export const authReady = new Promise((resolve) => { _resolverAuthReady = resolve; });

// Escuta a autenticação e faz o redirecionamento adequado.
onAuthStateChanged(auth, async (user) => {
    console.log("Estado de autenticação mudou. Utilizador detetado:", user);

    if (_resolverAuthReady) { _resolverAuthReady(user); _resolverAuthReady = null; }

    // Regista/atualiza o documento utilizadores/{uid} com o email, para a área
    // de Administração poder listar e identificar utilizadores por email.
    if (user) {
        import('./modules/tenant.js')
            .then(t => t.registarUtilizador(user.uid, user.email))
            .catch(() => {});
    }

    // Durante a reautenticação por password usada para confirmar eliminações
    // (ver seguranca-dados.js), o Firebase dispara este evento outra vez para o
    // mesmo utilizador. Nesse caso não navegamos, para não interromper o ecrã
    // onde a pessoa estava a trabalhar.
    if (window._suprimirRedirecionoAuth) return;

    if (user) {
        // Com sessão válida, o router decide para onde ir: se ainda não há
        // empresa ativa escolhida vai para 'empresas'; caso contrário, para
        // 'dashboard'. Centralizar esta decisão em router.js evita duplicar
        // esta lógica aqui e em cada módulo.
        window.router.navigateAposLogin();
    } else {
        const { reset } = await import('./modules/tenant.js');
        reset();
        window.router.navigate('login');
    }
});
