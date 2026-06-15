// ============================================================
//  app.js  –  Lógica de negócio: CRUD Firestore + Cálculos
// ============================================================

import { db } from "./firebase-config.js";
import {
  collection, addDoc, getDocs, doc, updateDoc,
  deleteDoc, query, orderBy, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Colecções ──────────────────────────────────────────────
const COL_FUNC      = "funcionarios";
const COL_VENCS     = "vencimentos";
const COL_BANCO_H   = "banco_horas";
const COL_FERIAS    = "ferias";
const COL_FALTAS    = "faltas";

// ── Tabelas IRS 2024 (simplificado — escalões mensais) ─────
const ESCALOES_IRS = [
  { limite:  778, taxa: 0.000 },
  { limite: 1000, taxa: 0.145 },
  { limite: 1500, taxa: 0.215 },
  { limite: 2000, taxa: 0.265 },
  { limite: 2500, taxa: 0.285 },
  { limite: 3200, taxa: 0.350 },
  { limite: 4100, taxa: 0.370 },
  { limite: 5000, taxa: 0.435 },
  { limite: Infinity, taxa: 0.480 }
];

// ── Taxa Seg. Social Trabalhador ───────────────────────────
const TAXA_SS_TRAB = 0.11;

// ── Helpers ────────────────────────────────────────────────
export function calcularVencimento(salarioBase, horasExtra = 0, faltas = 0) {
  const valorHoraExtra = (salarioBase / 176) * 1.5;
  const descontoFalta  = (salarioBase / 22) * faltas;
  const bruto          = salarioBase + (horasExtra * valorHoraExtra) - descontoFalta;

  const ss    = bruto * TAXA_SS_TRAB;
  const taxaIRS = ESCALOES_IRS.find(e => bruto <= e.limite)?.taxa ?? 0.48;
  const irs   = bruto * taxaIRS;
  const liquido = bruto - ss - irs;

  return {
    salarioBase: +salarioBase.toFixed(2),
    horasExtra,
    valorHorasExtra: +(horasExtra * valorHoraExtra).toFixed(2),
    faltas,
    descontoFaltas:  +descontoFalta.toFixed(2),
    bruto:   +bruto.toFixed(2),
    ss:      +ss.toFixed(2),
    taxaIRS: +(taxaIRS * 100).toFixed(1),
    irs:     +irs.toFixed(2),
    liquido: +liquido.toFixed(2)
  };
}

// ── Funcionários ───────────────────────────────────────────
export async function adicionarFuncionario(dados) {
  return addDoc(collection(db, COL_FUNC), {
    ...dados,
    criadoEm: serverTimestamp()
  });
}

export async function listarFuncionarios() {
  const q = query(collection(db, COL_FUNC), orderBy("nome"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function actualizarFuncionario(id, dados) {
  return updateDoc(doc(db, COL_FUNC, id), dados);
}

export async function eliminarFuncionario(id) {
  return deleteDoc(doc(db, COL_FUNC, id));
}

// ── Vencimentos ────────────────────────────────────────────
export async function gravarVencimento(funcionarioId, mes, ano, calc) {
  // Evita duplicados: elimina registo anterior para o mesmo mês/funcionário
  const q = query(
    collection(db, COL_VENCS),
    where("funcionarioId", "==", funcionarioId),
    where("mes", "==", mes),
    where("ano", "==", ano)
  );
  const snap = await getDocs(q);
  snap.docs.forEach(d => deleteDoc(d.ref));

  return addDoc(collection(db, COL_VENCS), {
    funcionarioId,
    mes,
    ano,
    ...calc,
    processadoEm: serverTimestamp()
  });
}

export async function listarVencimentos({ funcionarioId, mes, ano } = {}) {
  let q = collection(db, COL_VENCS);
  const filtros = [];
  if (funcionarioId) filtros.push(where("funcionarioId", "==", funcionarioId));
  if (mes)           filtros.push(where("mes", "==", +mes));
  if (ano)           filtros.push(where("ano", "==", +ano));
  if (filtros.length) q = query(q, ...filtros, orderBy("mes", "desc"));
  else                q = query(q, orderBy("mes", "desc"));

  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Banco de Horas ─────────────────────────────────────────
export async function adicionarMovimentoBH(dados) {
  return addDoc(collection(db, COL_BANCO_H), {
    ...dados,
    criadoEm: serverTimestamp()
  });
}

export async function listarMovimentosBH({ funcionarioId, ano } = {}) {
  const filtros = [];
  if (funcionarioId) filtros.push(where("funcionarioId", "==", funcionarioId));
  if (ano)           filtros.push(where("ano", "==", +ano));
  const q = filtros.length
    ? query(collection(db, COL_BANCO_H), ...filtros, orderBy("data", "desc"))
    : query(collection(db, COL_BANCO_H), orderBy("data", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function eliminarMovimentoBH(id) {
  return deleteDoc(doc(db, COL_BANCO_H, id));
}

// Saldo total de banco de horas de um colaborador
export async function saldoBancoHoras(funcionarioId) {
  const movs = await listarMovimentosBH({ funcionarioId });
  return movs.reduce((acc, m) => {
    const h = m.horas ?? 0;
    return m.tipo === "entrada" ? acc + h : acc - h;
  }, 0);
}

// ── Férias ─────────────────────────────────────────────────
export async function adicionarPedidoFerias(dados) {
  return addDoc(collection(db, COL_FERIAS), {
    ...dados,
    estado: "pendente",
    criadoEm: serverTimestamp()
  });
}

export async function listarFerias({ funcionarioId, ano, estado } = {}) {
  const filtros = [];
  if (funcionarioId) filtros.push(where("funcionarioId", "==", funcionarioId));
  if (ano)           filtros.push(where("ano",           "==", +ano));
  if (estado)        filtros.push(where("estado",        "==", estado));
  const q = filtros.length
    ? query(collection(db, COL_FERIAS), ...filtros, orderBy("dataInicio", "desc"))
    : query(collection(db, COL_FERIAS), orderBy("dataInicio", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function actualizarEstadoFerias(id, estado, observacao = "") {
  return updateDoc(doc(db, COL_FERIAS, id), { estado, observacao, actualizadoEm: serverTimestamp() });
}

export async function eliminarPedidoFerias(id) {
  return deleteDoc(doc(db, COL_FERIAS, id));
}

// Dias de férias aprovados num ano
export async function diasFeriasUsados(funcionarioId, ano) {
  const lista = await listarFerias({ funcionarioId, ano, estado: "aprovado" });
  return lista.reduce((acc, f) => acc + (f.diasUteis ?? 0), 0);
}

// ── Faltas ─────────────────────────────────────────────────
export async function adicionarFalta(dados) {
  return addDoc(collection(db, COL_FALTAS), {
    ...dados,
    criadoEm: serverTimestamp()
  });
}

export async function listarFaltas({ funcionarioId, ano, tipo } = {}) {
  const filtros = [];
  if (funcionarioId) filtros.push(where("funcionarioId", "==", funcionarioId));
  if (ano)           filtros.push(where("ano",           "==", +ano));
  if (tipo)          filtros.push(where("tipo",          "==", tipo));
  const q = filtros.length
    ? query(collection(db, COL_FALTAS), ...filtros, orderBy("data", "desc"))
    : query(collection(db, COL_FALTAS), orderBy("data", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function actualizarFalta(id, dados) {
  return updateDoc(doc(db, COL_FALTAS, id), { ...dados, actualizadoEm: serverTimestamp() });
}

export async function eliminarFalta(id) {
  return deleteDoc(doc(db, COL_FALTAS, id));
}

// ── Utilitários de formatação ───────────────────────────────
export const fmt = {
  euros: v => new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(v),
  pct:   v => `${v}%`,
  mes:   m => ["","Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][m] ?? m,
  data:  d => d ? new Date(d).toLocaleDateString("pt-PT") : "—",
  horas: h => {
    const abs = Math.abs(h);
    const hh  = Math.floor(abs);
    const mm  = Math.round((abs - hh) * 60);
    const str = mm > 0 ? `${hh}h ${mm}m` : `${hh}h`;
    return h < 0 ? `−${str}` : str;
  }
};
