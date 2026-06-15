// ============================================================
//  firebase-config.js  –  Configuração do SDK Firebase
//  IMPORTANTE: Substitua os valores abaixo pelas credenciais
//  do seu projecto no Firebase Console.
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// TODO: Substitua com as credenciais do seu projecto Firebase
const firebaseConfig = {
  apiKey: "AIzaSyC6rApsTwViPSVS3EoIo699IoKfWXknOu4",
  authDomain: "rh-amber.firebaseapp.com",
  projectId: "rh-amber",
  storageBucket: "rh-amber.firebasestorage.app",
  messagingSenderId: "720867955839",
  appId: "1:720867955839:web:3eece5c5295cffd7c45b4a",
  measurementId: "G-M0G5KM0QPH"
};


const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
