// assets/js/app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Escuta a autenticação
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Se logado, vai para o dashboard
        window.router.navigate('dashboard');
    } else {
        // Se não logado, vai para o login
        window.router.navigate('login');
    }
});
