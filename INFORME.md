# RestoHost — Informe de Monitoreo de Asistente de Voz IA

**Dataset:** 300 llamadas anónimas de marzo 2026 — TF Oakwood (150) y RT Buckhead (150)

> Los resultados numéricos completos (300 llamadas clasificadas, 77 tickets, estadísticas detalladas) se encuentran en la carpeta `output/`. 

---

## Pregunta 1 — ¿Qué está fallando?

De las 300 llamadas analizadas, **77 presentan algún tipo de fallo del asistente (25.7%)**. Se definió una taxonomía de 8 códigos de error con criterios de negocio claros para distinguir fallos reales de comportamientos correctos complejos.

### Taxonomía de errores y resultados

**BROKEN_PROMISE — 19 llamadas — Severidad CRÍTICA**
El agente confirma verbalmente que envió un SMS ("check your messages", "te envié un mensaje") pero el campo `textsSent` está vacío en el registro. Es el fallo más grave porque genera una expectativa falsa en el cliente: espera una confirmación que nunca llegó. Afecta principalmente reservaciones en RT Buckhead y pedidos de entrega en TF Oakwood.

**REPEAT_CALLER — 29 llamadas — Severidad MEDIA**
Un mismo número telefónico llama 3 o más veces por el mismo motivo sin que el problema se haya resuelto. Indica que el asistente no está cerrando el ciclo: el cliente vuelve porque su necesidad sigue sin atenderse. 29 llamadas de este tipo representan contactos que ya fueron fallidos al menos dos veces antes.

**NULL_CLASSIFICATION — 16 llamadas — Severidad MEDIA**
Llamadas con conversación real donde el campo `reasonForCalling` aparece como "Unclassified" o vacío. El asistente no pudo determinar el motivo de la llamada aun teniendo contexto suficiente para hacerlo. Esto impide el routing correcto y genera fricción innecesaria.

**AVOIDABLE_TRANSFER — 5 llamadas — Severidad ALTA**
El agente completa una tarea (p. ej. enviar enlace de pedido en línea) y luego transfiere la llamada de todas formas, cuando ya no era necesario. Cada transferencia innecesaria interrumpe al staff del restaurante y anula el valor de la automatización.

**STT_FAILURE — 2 llamadas — Severidad ALTA**
Fallo en el reconocimiento de voz: el agente repite "I'm sorry, I didn't catch that" o "¿Puedes repetir?" dos o más veces consecutivas sin procesar el audio del cliente. El cliente no puede comunicarse efectivamente con el asistente.

**LANGUAGE_MISMATCH — 3 llamadas — Severidad BAJA**
El asistente responde en el idioma equivocado respecto al idioma que usa el cliente en la conversación.

**UNFILTERED_SPAM — 3 llamadas — Severidad MEDIA**
Llamadas comerciales (ofertas de servicios de Google Business, SEO, etc.) que el asistente procesa como llamadas normales antes de colgar. Un filtro básico podría terminar estas llamadas en los primeros turnos.

**CORRECT_BEHAVIOR / NO_ERROR — 223 llamadas (74.3%)**
Las restantes 223 llamadas no presentan fallos del asistente. Muchas incluyen transferencias legítimas (el cliente explícitamente pide un humano, o la situación lo requiere) y comportamientos complejos correctamente manejados.

### Tickets generados

Se generaron **77 tickets accionables** — uno por cada llamada con error — cada uno con: descripción del fallo, por qué importa al negocio, y un fix propuesto concreto. Ver `output/tickets.json` para el listado completo.

---

## Pregunta 2 — ¿Qué patrones explican los fallos?

### Brecha entre restaurantes

La diferencia más llamativa es la tasa de transferencia: **TF Oakwood transfiere el 71.3% de sus llamadas vs. 47.3% en RT Buckhead**. Esta brecha de 24 puntos porcentuales no se explica solo por el tipo de restaurante — hay problemas estructurales específicos en cada uno.

TF Oakwood tiene una tasa de frustración del 68% (clientes con marcadores de impaciencia o insatisfacción en su transcripción) frente al 31.3% de RT Buckhead. El sentimiento promedio de TF Oakwood es negativo (-0.098) mientras RT Buckhead es positivo (0.145). TF Oakwood también tiene 93.8% de sus llamadas de entrega terminando en transferencia, cuando la mayoría debería resolverse con solo enviar un enlace de pedido online.

En RT Buckhead el problema más grave es distinto: prácticamente ninguna reservación recibe confirmación por SMS (0% de confirmación efectiva), lo que significa que las 39 reservaciones del mes quedaron sin constancia para el cliente.

### Patrones temporales

Las horas de mayor riesgo de fallo son las **20:00 (79% de tasa de transferencia) y las 21:00 (61%)**. El martes es el día de mayor volumen con 63 llamadas y una tasa de transferencia del 63.5%. El pico de actividad absoluta fue el 17 de marzo (probablemente St. Patrick's Day con 19 llamadas en un solo día). Los viernes nocturnos concentran las llamadas de mayor duración y mayor frustración.

### El problema del bypass humano

87 de 300 llamadas (29%) comienzan con el cliente pidiendo directamente hablar con una persona, sin darle oportunidad al asistente. Este es un síntoma de desconfianza acumulada: los clientes asumen que el asistente no puede resolver su problema. Sin datos históricos más extensos no es posible confirmar si esto empeoró, pero es una señal de adopción débil.

### Las 4 oportunidades priorizadas

Las oportunidades están ordenadas por relación impacto/esfuerzo. Los valores detallados (evidencia por llamada, impacto estimado mensual) están en `output/patterns.json`.

**Oportunidad 1 — Arreglar la confirmación SMS para reservaciones en RT Buckhead**
39 reservaciones en el mes no recibieron confirmación efectiva. Si un cliente no recibe confirmación, puede asumir que la reservación no quedó registrada y no presentarse — o llamar de nuevo. El fix técnico es directo: revisar y corregir el flujo de envío de SMS post-reservación. Impacto estimado: reducción del 10–20% en no-shows. Puntuación: impacto 9/10, esfuerzo 4/10.

**Oportunidad 2 — Eliminar transferencias evitables en pedidos de entrega (TF Oakwood)**
61 llamadas de pedido a domicilio (93.8% del total de ese tipo) terminan en transferencia. El asistente debería poder cerrar estos casos enviando el enlace de pedido online sin necesidad de involucrar al staff. Si se resuelve, potencialmente elimina ~61 interrupciones al personal por mes. Puntuación: impacto 8/10, esfuerzo 3/10.

**Oportunidad 3 — Detección temprana de spam**
3 llamadas comerciales fueron procesadas innecesariamente. Es un volumen bajo pero el fix es trivial: un filtro por palabras clave en los primeros 2 turnos de conversación terminaría estas llamadas antes de consumir tiempo de procesamiento. Puntuación: impacto 5/10, esfuerzo 2/10.

---

## Pregunta 3 (Bonus) — ¿Qué pasará la próxima semana?

**Semana proyectada: 6–12 de abril de 2026**

> **Advertencia de confianza: BAJA.** La proyección se basa en promediar el volumen por día de la semana con solo un mes de datos (marzo 2026). No hay datos de estacionalidad, no hay eventos conocidos para esa semana, y el dataset no es suficiente para un modelo de series de tiempo real. Tomar esta proyección como una referencia de orden de magnitud, no como un pronóstico preciso.

Con esa limitación explícita, el modelo estima un volumen semanal de aproximadamente **35 llamadas**, distribuidas así:

| Día | Llamadas estimadas |
|---|---|
| Lunes | 4 |
| Martes | 7 (pico) |
| Miércoles | 3 |
| Jueves | 4 |
| Viernes | 5 |
| Sábado | 7 |
| Domingo | 5 |

**TF Oakwood** (~21 llamadas): los motivos dominantes seguirán siendo entregas a domicilio (43%) y solicitudes de hablar con humano (27%).

**RT Buckhead** (~22 llamadas): los motivos dominantes serán solicitar humano (31%), reservaciones (26%) y entregas (17%).

Si los fallos actuales no se corrigen antes de esa semana, se espera que la tasa de transferencia siga en torno al 59% y que los BROKEN_PROMISE en RT Buckhead continúen afectando las reservaciones.

Los datos numéricos completos del pronóstico están en `output/forecast.json`.

---

## Dónde encontrar los resultados detallados

| Archivo | Contenido |
|---|---|
| `output/classified_calls.json` | Las 300 llamadas con código de error, severidad y fix propuesto |
| `output/tickets.json` | 77 tickets accionables, uno por error detectado |
| `output/descriptive_stats.json` | Estadísticas completas: volumen, duración, SMS, sentiment, repeat callers |
| `output/patterns.json` | Patrones temporales, comparativa restaurantes, 4 oportunidades con evidencia |
| `output/forecast.json` | Pronóstico semanal con desglose por día y restaurante |
| `output/sentiment_analysis.json` | Sentimiento por llamada, distribución de emociones, correlación mood↔outcome |

Para visualizar todo esto de forma interactiva: `npm run dashboard` → [http://localhost:5173](http://localhost:5173)
