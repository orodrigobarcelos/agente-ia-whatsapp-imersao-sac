/**
 * Tool de exemplo (built-in): retorna data/hora atual.
 *
 * Mostra o padrão básico de criar uma tool. Sem dependências externas,
 * sem requests, só JS puro. Use como referência ao criar tools custom.
 */
import { registerTool } from '../registry.js';

registerTool({
  name: 'current_time',
  description:
    'Retorna a data e hora atual no fuso horário de São Paulo (Brasil). ' +
    'Use quando o cliente perguntar que dia é hoje, que horas são, qual o ' +
    'dia da semana, ou se referir a "agora", "hoje", "amanhã" e você ' +
    'precisar do contexto temporal exato.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
    additionalProperties: false,
  },
  handler: async () => {
    const now = new Date();
    const dataHoraBrasil = now.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      dateStyle: 'full',
      timeStyle: 'short',
    });
    const diaSemana = now.toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'long',
    });
    return {
      data_hora_brasil: dataHoraBrasil,
      dia_semana: diaSemana,
      iso_utc: now.toISOString(),
    };
  },
});
