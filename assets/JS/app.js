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

// Escuta a autenticação e faz o redirecionamento
onAuthStateChanged(auth, (user) => {
    // ESTA É A LINHA DO LOG PARA DEBUGAR
    console.log("Estado de autenticação mudou. Utilizador detetado:", user);

    // Durante a reautenticação por password usada para confirmar eliminações
    // (ver seguranca-dados.js), o Firebase dispara este evento outra vez para o
    // mesmo utilizador. Nesse caso não navegamos, para não interromper o ecrã
    // onde a pessoa estava a trabalhar.
    if (window._suprimirRedirecionoAuth) return;

    if (user) {
        // Se logado, vai para o dashboard
        window.router.navigate('dashboard');
    } else {
        // Se não logado, vai para o login
        window.router.navigate('login');
    }
});
