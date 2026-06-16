// assets/js/modules/ferias-utils.js
// Utilitário partilhado — sem dependências de Firebase ou DOM

/**
 * Calcula os dias de férias a que o funcionário tem direito no anoAlvo.
 *
 * Ano de admissão:
 *   - Admissão a 1 de Janeiro → direito pleno (limiteDiasFerias)
 *   - Qualquer outro dia       → 2 dias × meses trabalhados (mês admissão conta),
 *                                 máximo 20 dias
 * Anos seguintes: limiteDiasFerias (normalmente 22)
 */
export function calcularDireitoFerias(admissaoStr, anoAlvo, limiteDiasFerias = 22) {
    if (!admissaoStr) return limiteDiasFerias;

    // Forçar parse local (evita desvios de timezone)
    const partes = admissaoStr.split('-');
    const adm = new Date(parseInt(partes[0]), parseInt(partes[1]) - 1, parseInt(partes[2]));
    const anoAdm = adm.getFullYear();

    // Anos seguintes à admissão → direito pleno
    if (anoAlvo !== anoAdm) return limiteDiasFerias;

    // Excepção: admitido a 1 de Janeiro → direito pleno
    if (adm.getMonth() === 0 && adm.getDate() === 1) return limiteDiasFerias;

    // Meses trabalhados no ano de admissão (mês de admissão inclusive)
    // Janeiro=0 … Dezembro=11 → meses trabalhados = 12 - mesAdmissao (0-based)
    const mesesTrabalhados = 12 - adm.getMonth(); // ex: Junho(5) → 12-5 = 7 meses
    return Math.min(mesesTrabalhados * 2, 20);
}

/**
 * Calcula feriados nacionais de Portugal para um dado ano.
 * Retorna array de { data: "MM-DD", nome: string }
 */
export function feriadosPortugal(ano) {
    const a=ano%19, b=Math.floor(ano/100), c=ano%100, d=Math.floor(b/4), e=b%4;
    const f=Math.floor((b+8)/25), g=Math.floor((b-f+1)/3);
    const h=(19*a+b-d-g+15)%30, i=Math.floor(c/4), k=c%4;
    const l=(32+2*e+2*i-h-k)%7, m=Math.floor((a+11*h+22*l)/451);
    const mp=Math.floor((h+l-7*m+114)/31), dp=((h+l-7*m+114)%31)+1;
    const p = new Date(ano, mp-1, dp);
    const add = (x,n) => { const r=new Date(x); r.setDate(x.getDate()+n); return r; };
    const fmt = x => `${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;
    return [
        {data:'01-01', nome:'Ano Novo'},
        {data:fmt(add(p,-47)), nome:'Carnaval'},
        {data:fmt(add(p,-2)),  nome:'Sexta-feira Santa'},
        {data:fmt(p),          nome:'Páscoa'},
        {data:'04-25', nome:'Dia da Liberdade'},
        {data:'05-01', nome:'Dia do Trabalhador'},
        {data:fmt(add(p,60)),  nome:'Corpo de Deus'},
        {data:'06-10', nome:'Dia de Portugal'},
        {data:'08-15', nome:'Assunção de N. Sra.'},
        {data:'10-05', nome:'Implantação da República'},
        {data:'11-01', nome:'Todos os Santos'},
        {data:'12-01', nome:'Restauração da Independência'},
        {data:'12-08', nome:'Imaculada Conceição'},
        {data:'12-25', nome:'Natal'},
    ];
}
