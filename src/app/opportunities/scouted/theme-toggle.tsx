"use client";

export const THEME_ROOT_ID = "bx-raiz";
export const THEME_STORAGE_KEY = "gsipro:buscador:tema";

/**
 * Script de arranque, injetado antes da pintura pelo componente de servidor.
 *
 * O tema é escrito direto no atributo do contêiner, e não em estado do React,
 * por dois motivos: evita o piscar do tema errado entre o HTML do servidor e a
 * hidratação, e dispensa transformar a fila inteira em componente de cliente.
 *
 * `localStorage` lança em janela anônima e com armazenamento bloqueado, por
 * isso tudo vai dentro de try/catch: sem preferência guardada a tela segue o
 * tema do sistema e continua correta, só não lembra da escolha.
 */
export const themeBootScript = `(function(){try{var r=document.getElementById(${JSON.stringify(THEME_ROOT_ID)});if(!r)return;var s=null;try{s=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})}catch(e){}if(s!=="claro"&&s!=="escuro"){s=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"escuro":"claro"}r.setAttribute("data-tema",s)}catch(e){}})();`;

const sol = (
  <svg aria-hidden="true" className="sol" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2.6v2.2M12 19.2v2.2M4.2 12H2M22 12h-2.2M6.3 6.3 4.8 4.8M19.2 19.2l-1.5-1.5M17.7 6.3l1.5-1.5M4.8 19.2l1.5-1.5" />
  </svg>
);

const lua = (
  <svg aria-hidden="true" className="lua" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M20.5 14.3A8.6 8.6 0 0 1 9.7 3.5a8.6 8.6 0 1 0 10.8 10.8Z" />
  </svg>
);

/**
 * Os dois ícones e os dois rótulos são sempre desenhados; qual aparece é
 * decidido pelo CSS a partir do `data-tema` do contêiner. Assim o botão não
 * guarda estado nenhum e nunca discorda do que está na tela.
 */
export function ThemeToggle() {
  function alternar() {
    const root = document.getElementById(THEME_ROOT_ID);
    if (!root) return;
    const proximo = root.getAttribute("data-tema") === "escuro" ? "claro" : "escuro";
    root.setAttribute("data-tema", proximo);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, proximo);
    } catch {
      // Sem persistência a escolha vale só para esta visita — aceitável.
    }
  }

  return (
    <button aria-label="Alternar entre modo diurno e noturno" className="bx-tema" onClick={alternar} type="button">
      <span className="bx-tema-icone">{sol}{lua}</span>
      <span className="bx-tema-rot"><span className="claro">Modo diurno</span><span className="escuro">Modo noturno</span></span>
    </button>
  );
}
