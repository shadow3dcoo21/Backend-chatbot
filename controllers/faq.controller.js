import { stringSimilarity } from "string-similarity-js";

// Base de datos de FAQs
const faqs = [
  {
    variantes: [
      "¿Dónde está ubicado el colegio?",
      "¿Dónde queda el colegio?",
      "¿Cuál es la dirección del colegio?",
      "¿Dónde se encuentra su sede?",
      "Ubicación del colegio"
    ],
    respuesta: "Nos ubicamos en Av. Aviación 445, Cerro Colorado – Arequipa."
  },
  {
    variantes: [
      "¿Cuál es la misión del colegio?",
      "¿Qué misión tiene el colegio?",
      "¿Cuál es su propósito?",
      "¿Qué objetivos tiene el colegio?",
      "Misión del colegio"
    ],
    respuesta: "Formar estudiantes comprometidos con la fe, la excelencia y los valores de “Luz y Verdad”."
  },
  {
    variantes: [
      "¿Puedo agendar una entrevista de admisión?",
      "¿Se puede programar una entrevista?",
      "¿Puedo reservar una cita de admisión?",
      "¿Cómo agendo una entrevista?",
      "Entrevista de admisión"
    ],
    respuesta: "Claro. Podemos agendarla para usted. ¿Prefiere presencial o virtual?"
  },
  {
    variantes: [
      "¿Qué idiomas enseñan?",
      "¿Tienen clases de inglés?",
      "¿Qué lenguas enseñan en el colegio?",
      "¿Enseñan inglés en su escuela?",
      "Idiomas del colegio"
    ],
    respuesta: "Contamos con un programa de inglés certificado por Cambridge."
  },
  {
    variantes: [
      "¿Qué documentos se necesitan para postular?",
      "¿Qué requisitos debo cumplir?",
      "¿Cuáles son los documentos necesarios para la admisión?",
      "Documentos para postular",
      "Requisitos de admisión"
    ],
    respuesta: "Puede consultarlo en la sección de requisitos. ¿Le gustaría que le muestre?"
  },
  {
    variantes: [
      "¿Qué horario de atención tienen?",
      "¿Cuál es el horario de atención?",
      "¿A qué hora están abiertos?",
      "Horario de atención",
      "¿En qué horario atienden?"
    ],
    respuesta: "Atendemos de lunes a viernes de 8:00 a 16:00."
  }
];

/**
 * Busca la mejor respuesta automática según el mensaje del usuario.
 * @param {string} mensaje - El mensaje del usuario.
 * @param {number} umbral - Similitud mínima (0 a 1).
 * @returns {string|null}
 */
function obtenerRespuestaFAQ(mensaje, umbral = 0.6) {
  for (const faq of faqs) {
    for (const variante of faq.variantes) {
      if (stringSimilarity(mensaje, variante) >= umbral) {
        return faq.respuesta;
      }
    }
  }
  return null;
}

export {
  obtenerRespuestaFAQ,
  faqs,
}; 