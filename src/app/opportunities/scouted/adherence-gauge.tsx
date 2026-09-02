/**
 * Velocímetro de PRÉ-REQUISITOS atendidos, 0 a 100.
 *
 * Mede quantos dos pré-requisitos da licitação a empresa cumpre — acervo,
 * porte, prazo, valor e o que o edital exige. Já mediu "aderência ao perfil" e
 * depois "cobertura de acervo"; as duas eram estreitas demais para servirem de
 * número único da linha.
 *
 * Renderiza no servidor: é desenho puro, sem estado nem interação, então não
 * precisa atravessar a fronteira para o navegador.
 *
 * ⚠️ `large-arc-flag` é SEMPRE 0. O arco varre no máximo meia volta (180°), e
 * marcá-lo como arco maior faz o traço sair pelo lado de fora da caixa — foi
 * exatamente o defeito da prévia v11.
 */

const CX = 50;
const CY = 46;
const R = 34;

/** Grau 180 fica à esquerda (nota 0) e grau 0 à direita (nota 100). */
function pointAt(score: number, radius: number): readonly [number, number] {
  const angle = ((180 - (Math.max(0, Math.min(100, score)) / 100) * 180) * Math.PI) / 180;
  return [CX + radius * Math.cos(angle), CY - radius * Math.sin(angle)];
}

function arcTo(score: number): string {
  const [x0, y0] = pointAt(0, R);
  const [x, y] = pointAt(score, R);
  // sweep 1 = sentido horário, passando por cima. large-arc 0, sempre.
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${R} ${R} 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)}`;
}

const ticks = [0, 25, 50, 75, 100];

export function AdherenceGauge({ score, undetermined, aria }: { score: number; undetermined: boolean; aria?: string }) {
  const value = undetermined ? 0 : Math.max(0, Math.min(100, Math.round(score)));
  const [nx, ny] = pointAt(value, R * 0.66);

  return (
    <svg
      aria-label={aria ?? (undetermined ? "Pré-requisitos não avaliados" : `Pré-requisitos atendidos: ${value}%`)}
      className="bx-medidor"
      height="74"
      role="img"
      viewBox="0 0 100 74"
      width="100"
    >
      <path className="trilha" d={arcTo(100)} fill="none" strokeLinecap="round" strokeWidth="7" />

      {!undetermined && value > 0 && (
        <path className="arco" d={arcTo(value)} fill="none" strokeLinecap="round" strokeWidth="7" />
      )}

      {ticks.map((tick) => {
        const [x1, y1] = pointAt(tick, R + 5.5);
        const [x2, y2] = pointAt(tick, R + 8.5);
        return <line className="marca" key={tick} strokeLinecap="round" strokeWidth="1.4" x1={x1} x2={x2} y1={y1} y2={y2} />;
      })}

      {!undetermined && (
        <>
          <line className="agulha" strokeLinecap="round" strokeWidth="2" x1={CX} x2={nx} y1={CY} y2={ny} />
          <circle className="pino" cx={CX} cy={CY} r="2.8" />
        </>
      )}

      <text className="bx-medidor-n" x={CX} y={CY + 16}>
        {undetermined ? "—" : `${value}%`}
      </text>
      <text className="bx-medidor-rot" x={CX} y={CY + 26}>
        pré-requisitos
      </text>
    </svg>
  );
}
