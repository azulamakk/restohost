## Stack tecnológico

### Runtime: Node.js + tsx

**Decisión:** Usar Node.js con `tsx` para correr el pipeline TypeScript.

**Por qué:** Node.js es el runtime estándar más ampliamente adoptado. `tsx` permite ejecutar TypeScript directamente sin paso de compilación explícito, manteniendo la experiencia de desarrollo fluida. 

**Trade-off:** `tsx` añade un paso de transpilación en memoria, pero para un pipeline batch de 300 llamadas el cold-start es irrelevante frente al tiempo de I/O y las llamadas a la API.

### Frontend: React

**Decisión:** Usar React como biblioteca de UI para el dashboard.

**Por qué:** React es la biblioteca frontend más adoptada de la industria. Tiene el ecosistema más amplio (Recharts, shadcn/ui, Radix, React Query), soporte TypeScript maduro y documentación exhaustiva. Cualquier desarrollador frontend puede contribuir sin necesidad de aprender un framework de nicho. 

**Alternativa considerada:** Vue.js o Svelte serían igualmente válidos técnicamente, pero React tiene mayor adopción en el ecosistema de startups SaaS.

### Build tool: Vite + Express

**Decisión:** Usar Vite como build tool + dev server para el frontend React, con Express como API backend separado.

**Por qué:** Vite es el estándar actual para proyectos React modernos: hot reload instantáneo, soporte TypeScript nativo, y configuración mínima. El proxy de Vite hacia la API Express (puerto 3001) mantiene el desarrollo simple sin CORS complejo. La separación frontend/API también facilita el deploy si el proyecto escala.

**Trade-off:** Requiere dos procesos en desarrollo (API + Vite dev server), gestionado con `concurrently`. Next.js hubiese unificado ambos, pero es excesivo para un dashboard local de análisis.

### Charts: Recharts sobre D3.js

**Decisión:** Usar Recharts para visualizaciones.

**Por qué:** Recharts tiene una API declarativa compatible con React, no requiere manipulación del DOM, y tiene todos los tipos de gráficos necesarios (Line, Bar, Pie, Scatter). D3.js sería más flexible pero añade complejidad innecesaria para los gráficos estándar que necesita este dashboard.

---

## Clasificación de errores

### Approach híbrido: reglas determinísticas + LLM

**Decisión:** Aplicar reglas determinísticas primero. Solo enviar al LLM los casos que las reglas no cubren.

**Por qué:** Las reglas son más baratas, más rápidas, y más explicables. Para casos como "el agente dijo que mandó un SMS pero `textsSent` está vacío" o "el agente terminó la llamada en AgentHangup con una solicitud de Google Business", una regla con alta confianza (>95%) es más confiable que un LLM que puede alucinar o variar. El LLM agrega valor en los casos ambiguos: ¿esta transferencia era evitable dado el contexto de la conversación?

**Cuando una regla es suficiente:**
- BROKEN_PROMISE: la evidencia está en un campo estructurado (`textsSent` vacío) + keyword de promesa en el texto. Determinístico.
- UNFILTERED_SPAM: el patrón de texto del spam es específico y repetible. No necesita comprensión semántica.
- STT_FAILURE: el patrón "I'm ..." repetido es específico del bug de STT. Determinístico.
- NULL_CLASSIFICATION: el campo `reasonForCalling` está vacío. Trivialmente determinístico.
- REPEAT_CALLER: se computa desde los datos estructurados (phone + reason).

**Cuando el LLM agrega valor:**
- AVOIDABLE_TRANSFER: ¿era el transfer evitable? Requiere entender si la conversación había llegado a una conclusión satisfactoria o no. Una regla basada en `callEndReason == CallTransfer` daría falsos positivos masivos (las transferencias de Lost Items son correctas).
- INCOMPLETE_FLOW: ¿el agente recopiló los datos de reserva pero nunca confirmó? Requiere seguir el flujo de la conversación.

**Costo:** ~$0.025 por ejecución completa con claude-haiku-4-5. El prompt caching reduce el costo del prompt de sistema en ~60% (se reutiliza en las ~200 llamadas que van al LLM).

### Modelo: claude-haiku-4-5 para clasificación batch

**Decisión:** Usar claude-haiku-4-5 para la clasificación de las 300 llamadas, y no claude-sonnet-4-6.

**Por qué:** La clasificación de errores es una tarea relativamente simple: leer una conversación corta (~300-500 tokens) y asignar una de 8 categorías. claude-haiku-4-5 es suficientemente preciso para esta tarea y cuesta ~10x menos que sonnet. Con 300 llamadas y un presupuesto acotado para una prueba técnica, la eficiencia de costo es relevante.

**Cuándo usaría sonnet:** Si el dataset fuese de miles de llamadas con conversaciones muy largas y matices sutiles (por ejemplo, detectar el momento exacto donde el asistente tomó una decisión incorrecta dentro de un flujo de 20 turnos), sonnet daría mejor calidad por dólar gastado.

---

## Taxonomía de errores

### Qué se incluyó y por qué

Cada error en la taxonomía cumple dos condiciones: (1) tiene evidencia en el dataset y (2) tiene impacto en el negocio o la experiencia del cliente.

**BROKEN_PROMISE (CRITICAL):** Incluida porque el dataset muestra 13 llamadas donde el asistente promete explícitamente una confirmación por SMS que nunca llega. Esto no es un problema de diseño menor: para reservas, el cliente puede aparecer en el restaurante sin booking real. Es el error más grave del dataset.

**AVOIDABLE_TRANSFER (HIGH):** Incluida porque TF Oakwood transfiere el 93.8% de sus llamadas de delivery aun después de haber completado su función. Cada transfer es una interrupción de staff que cuesta ~2 minutos. A 61 calls/mes, es carga operacional evitable.

**STT_FAILURE (HIGH):** Incluida aunque es un error de infraestructura, no de lógica del agente, porque el agente es el que se comunica con el cliente. Si el cliente escucha al asistente decir "I'm ..." tres veces seguidas, la experiencia es mala independientemente de quién sea el culpable técnico.

**INCOMPLETE_FLOW (HIGH):** Incluida para separar el caso donde el agente recopila datos de reserva correctamente pero no los confirma (vs BROKEN_PROMISE donde el agente afirma haber enviado algo). En el dataset, la mayoría de los casos de RT Buckhead con reservaciones incompletas caen en BROKEN_PROMISE; INCOMPLETE_FLOW captura los casos donde el agente simplemente no llegó al paso de confirmación.

**NULL_CLASSIFICATION (MEDIUM):** Incluida porque 28 llamadas sin `reasonForCalling` son puntos ciegos del sistema de monitoreo. No es un error del asistente de voz, pero sí del pipeline de clasificación.

**UNFILTERED_SPAM (MEDIUM):** Incluida porque contamina métricas (AgentHangup no debería ser 1.7% si filtramos spam) y gasta tokens de API.

**REPEAT_CALLER (MEDIUM):** Incluida porque múltiples llamadas del mismo número por el mismo motivo indican que el asistente no resolvió el problema en intentos anteriores. No es un error en la llamada individual, sino un patrón sistémico.

**LANGUAGE_MISMATCH (LOW):** Incluida como señal de calidad pero con severidad baja. Afecta solo 2-3 llamadas de RT Buckhead y probablemente es contaminación de prompts, no un bug crítico.

### Qué se descartó y por qué

- **"Llamada corta = error"**: No. Muchas llamadas de 17-21 segundos son limpias (informar que no hay reservaciones, responder una pregunta de horario). La duración corta solo es señal cuando se combina con otros factores.
- **"CallTransfer = error"**: No. Las transferencias de Lost Items, Manager Requests legítimos, y llamadas fuera de horario son el comportamiento correcto. Generalizar esto daría cientos de falsos positivos.
- **"UserHangup = frustración"**: No. La mayoría de los UserHangup son resoluciones limpias donde el cliente tiene lo que necesitaba.

---

## Limitaciones del dataset

### Lo que no se puede concluir con este dataset

1. **No se puede generalizar a otros restaurantes.** El dataset tiene solo 2 restaurantes con perfiles operacionales distintos. Los patrones de TF Oakwood (delivery puro, español) y RT Buckhead (sit-down + reservas, inglés) no necesariamente aplican a otros clientes de RestoHost.

2. **No se sabe si las reservas de RT Buckhead se confirmaron por otro canal.** El campo `textsSent` registra los SMS enviados por el sistema automatizado. Es posible que el staff de RT Buckhead llame de vuelta a los clientes para confirmar. Si esto ocurre, el `BROKEN_PROMISE` en el sistema no es un fallo completo desde la perspectiva del cliente, aunque sí es un fallo de diseño del asistente.

3. **No hay ground truth de satisfacción del cliente.** Los marcadores de frustración detectados son heurísticas basadas en keywords. No hay una métrica directa de "el cliente quedó satisfecho con esta llamada". Un análisis real requeriría encuestas post-llamada o NPS.

4. **1 mes de datos no captura estacionalidad.** Marzo puede ser un mes atípico (St. Patrick's Day, inicio de primavera) o representativo. Sin datos de otros meses no se puede saber.

5. **El modelo de predicción de próxima semana tiene confianza MUY BAJA.** Con 4-5 observaciones por día de la semana, el error estándar es alto. No usar para decisiones de staffing.

6. **Los teléfonos anonimizados son consistentes pero no verificables.** El token `CALLER-D8C5436F` con 14 llamadas idénticas podría ser un bot de testing del equipo de RestoHost, un cliente confundido, o una anomalía del sistema de anonimización. No se puede determinar sin cruzar con datos de producción.

### Qué haría diferente con más datos

- **Labels de satisfacción del cliente** (encuesta post-llamada, NPS) para validar la taxonomía de errores y medir el impacto real de cada tipo de error.
- **Historial de 6+ meses** para detectar tendencias, estacionalidad, y el impacto real de las correcciones implementadas.
- **A/B testing** de los fixes propuestos: comparar tasa de transferencia y satisfacción antes y después de implementar cada oportunidad.
- **Modelo de predicción real**: con 6+ meses de datos, Prophet o un modelo ARIMA estacional tendría confianza suficiente para informar decisiones operacionales.
- **Embeddings de conversaciones** para clustering semántico de tipos de llamada y detección de nuevas categorías no previstas en la taxonomía.

---

## Approach de predicción (Pregunta 3)

### Modelo elegido: promedio por día de la semana (DOW averaging)

**Decisión:** Usar el promedio histórico de llamadas por día de la semana como predictor de volumen para la próxima semana, segmentado por restaurante.

**Por qué este approach:** Con solo 4-5 observaciones por día de la semana (marzo tiene ~4.3 semanas), cualquier modelo más sofisticado estaría sobreajustado. Un modelo ARIMA estacional necesita al menos 2 períodos completos del ciclo estacional para estimar el componente seasonal — lo que requeriría mínimo 2 años de datos semanales. Prophet requiere al menos 1 año de datos diarios para detectar patrones estacionales confiables. Con un mes, el DOW average es el único estimador con respaldo estadístico razonable; los demás producirían intervalos de confianza tan amplios que serían inútiles operacionalmente.

**Por restaurante:** El output incluye `byRestaurant` con predicciones separadas para TF Oakwood y RT Buckhead. Los dos restaurantes tienen perfiles de demanda distintos: TF Oakwood tiene pico el martes y alto volumen de delivery orders (~43%), mientras que RT Buckhead tiene pico el sábado y mayor proporción de reservas (~26%). Agregar ambos en un único número oscultaría estas diferencias operacionales.

**Cómo conecta predicción → acción preventiva:** El sistema no usa la predicción solo como número de volumen: para cada señal detectada en el forecast (>30% delivery en TF Oakwood, >15% reservas en RT Buckhead el fin de semana, día pico con ≥6 llamadas, etc.) genera un `AssistantAdjustment` concreto que describe qué cambiar en el comportamiento del asistente antes de que lleguen esas llamadas. El array `assistantAdjustments` tiene prioridad `HIGH/MEDIUM/LOW` y está separado de los `preventiveRecommendations` dirigidos a operaciones humanas — son acciones para el sistema de IA, no para el equipo.

**Honestidad sobre la confianza:** El forecast tiene `confidenceLevel: 'LOW'` explícito en el output JSON. El caveat menciona la distorsión del 17 de marzo (St. Patrick's Day), la imposibilidad de capturar estacionalidad con un mes, y que no debe usarse para decisiones de staffing. Con 6+ meses de datos se usaría Prophet o ARIMA estacional, como se detalla en la sección siguiente.

---

## Qué haría diferente con más tiempo

- Logging estructurado del costo real de API por llamada (no solo estimado).
- Dockerizar el pipeline para reproducibilidad completa en cualquier máquina.
- Agregar autenticación básica al dashboard si fuese a ser expuesto en red.
- Tests de integración que corran el pipeline completo contra un subconjunto fijo del dataset y verifiquen que los outputs no cambian (regression test).
- Internacionalización del dashboard (el frontend está en inglés, podría tener toggle ES/EN).
