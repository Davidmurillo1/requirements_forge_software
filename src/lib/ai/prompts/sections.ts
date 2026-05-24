import type { ElicitationSection } from "@/lib/ai/schemas";

export const SECTION_TITLES: Record<ElicitationSection, string> = {
  project_context: "Contexto del proyecto y caso de negocio",
  stakeholders_personas: "Stakeholders y personas",
  scope: "Alcance (in / out)",
  business_process: "Proceso de negocio soportado",
  user_stories: "Historias de usuario",
  nfrs: "Requerimientos no funcionales (FURPS+)",
  domain_data: "Datos y entidades del dominio",
  integrations: "Integraciones con sistemas externos",
  ui_ux: "Consideraciones de UI/UX",
  constraints_assumptions_risks: "Restricciones, supuestos y riesgos",
  glossary: "Glosario / lenguaje ubicuo",
};

export const SECTION_ORDER: ElicitationSection[] = [
  "project_context",
  "stakeholders_personas",
  "scope",
  "business_process",
  "user_stories",
  "nfrs",
  "domain_data",
  "integrations",
  "ui_ux",
  "constraints_assumptions_risks",
  "glossary",
];

export const SECTION_PROMPTS: Record<ElicitationSection, string> = {
  project_context: `Sección: Contexto del proyecto y caso de negocio.
Objetivo: entender por qué existe el proyecto, qué problema resuelve, qué valor de negocio busca, qué éxito se ve.
Preguntas clave a cubrir: nombre del proyecto y cliente, problema actual, impacto del problema (medible si es posible), objetivos de negocio (con KPI cuando aplique), criterios de éxito a 3-12 meses, restricciones de presupuesto/tiempo conocidas, riesgos de no hacer nada.`,

  stakeholders_personas: `Sección: Stakeholders y personas.
Objetivo: identificar a las personas y grupos que influyen, financian o usan el sistema.
Cubre: stakeholders (nombre, rol, nivel de influencia low/medium/high, contacto), personas/arquetipos de usuario final (primary/secondary/antagonist, objetivos, frustraciones).
Distingue siempre stakeholder (quien decide/financia) de persona (quien usa).`,

  scope: `Sección: Alcance (in / out).
Objetivo: separar qué hace y qué NO hace el sistema. Cada item out-of-scope debe tener justificación.
Pregunta por capabilities incluidas, capabilities excluidas explícitamente, supuestos de scope, integraciones que SÍ se conectan vs las que NO en esta versión.`,

  business_process: `Sección: Proceso de negocio soportado.
El proceso ya está mejorado (asumir BPMN/mejora previa). Captura su descripción de alto nivel, actores que participan, eventos disparadores, pasos críticos, reglas de negocio explícitas, métricas operativas que se quieren mejorar. Si hay un archivo BPMN o diagrama referenciado, regístralo como business_process_ref.`,

  user_stories: `Sección: Historias de usuario.
Cada historia en formato "Como <rol>, quiero <acción>, para <beneficio>". Cada historia debe poder tener ≥1 criterio Gherkin (Dado/Cuando/Entonces) — guía al usuario para escribirlos.
Detecta historias gigantes que deben descomponerse. Verifica que el rol esté en stakeholders o personas; si aparece un rol nuevo, marca fact_extraction para registrarlo.`,

  nfrs: `Sección: Requerimientos no funcionales (FURPS+).
Cada NFR debe pertenecer a una categoría: functionality, usability, reliability, performance, supportability, security, compliance.
Cada NFR DEBE tener una métrica medible. "Rápido", "fácil", "muchos usuarios" son vaguedad — siempre repregunta por métrica (ej. p95 latencia < 500ms con 100 RPS).`,

  domain_data: `Sección: Datos y entidades del dominio.
Captura entidades, sus atributos (nombre, tipo, nullable), y las relaciones. No es esquema de BD — es modelo conceptual del dominio.
Pregunta por entidad raíz, ciclo de vida, identidad natural, eventos de dominio importantes. Detecta términos sin definir y sugiere agregarlos al glosario.`,

  integrations: `Sección: Integraciones con sistemas externos.
Por cada integración: nombre, dirección (inbound/outbound/bidirectional), formato (JSON, CSV, XML, webhook, MQ), frecuencia (real-time, batch diario, on-demand), criticidad (low/medium/high), endpoint o referencia, manejo de errores esperado.`,

  ui_ux: `Sección: Consideraciones de UI/UX.
No es diseño visual — son requerimientos de experiencia: dispositivos soportados, accesibilidad (WCAG AA/AAA), idiomas, flujos críticos que necesitan ser obvios, patrones a evitar, expectativas de carga/onboarding.`,

  constraints_assumptions_risks: `Sección: Restricciones, supuestos y riesgos.
Restricciones: condiciones inviolables (tecnología fija, presupuesto, normativas).
Supuestos: lo que se da por cierto pero no verificado (con responsable de verificar y fecha).
Riesgos: probabilidad × impacto + mitigación propuesta.`,

  glossary: `Sección: Glosario / lenguaje ubicuo.
Términos del dominio con definición precisa. Si en otras secciones aparecieron términos sin definir, recógelos aquí. Detecta sinónimos y elige el término canónico para evitar ambigüedad.`,
};
