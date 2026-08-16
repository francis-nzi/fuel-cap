import type { Dictionary } from "./types";

const es: Dictionary = {
  hero: {
    badge: "El acceso anticipado ya está abierto",
    headlineLine1: "Limita tu precio.",
    headlineLine2: "Nunca pagues de más.",
    subhead:
      "Bloquea el precio de hoy de la {fuelWord}. Si el precio en el surtidor baja de tu precio bloqueado, FuelCap te reembolsa la diferencia automáticamente — directo a tu depósito.",
    priceRisesLabel: "El precio sube",
    priceFallsLabel: "El precio baja",
    youWin: "Ganas tú",
    tagline: "Cara ganas tú. Cruz ganas tú.",
    cta: "Consigue acceso anticipado",
    ctaSub: "Sin comisiones. Sin compromiso. Tarda 30 segundos.",
  },
  viral: {
    eyebrow: "Hecho para compartir",
    headline: "Tres momentos que la gente no puede evitar compartir",
    feature1Eyebrow: "El momento viral",
    feature1Headline: "En cuanto baja el precio de la {fuelWord}, te pagan a ti.",
    feature1Quote: "«La gasolina bajó. Recuperé {refundAmount}.»",
    feature1Body:
      "Una celebración a pantalla completa aparece en el momento en que el precio baja de tu precio bloqueado. Una sorpresa real que la gente captura y comparte — no es un cupón, es un reembolso de verdad.",
    feature2Eyebrow: "Para presumir",
    feature2Headline: "Convierte tu ahorro privado en estatus público.",
    feature2Quote: "«Llevo 6 meses sin pagar el precio completo de la gasolina.»",
    feature2Body:
      "Una tarjeta de resultados lista para publicar muestra el dinero ahorrado y tu racha sin precio completo — un toque para compartirla en Stories, Reels o TikTok.",
    feature3Eyebrow: "El motor de crecimiento",
    feature3Headline: "Tu grupo. Gasolina más barata para todos.",
    feature3Quote: "«Metí a todo mi grupo de WhatsApp para plantar cara a la gasolina a {highPrice}.»",
    feature3Body:
      "Cada amigo que se une baja aún más tu precio bloqueado por litro — compartir te interesa a ti, no es un favor.",
    cta: "Quiero apuntarme",
  },
  how: {
    eyebrow: "Cómo funciona",
    headline: "Tres toques. Cero riesgo.",
    step1Title: "Bloquea un precio",
    step1Body:
      "Elige el tipo de combustible y cuántos litros. Tu precio queda bloqueado al precio de hoy, sin comisiones.",
    step2Title: "Mantente protegido",
    step2Body:
      "¿Sube el precio? Sigues pagando tu precio bloqueado. ¿Baja? Se te reembolsa la diferencia automáticamente.",
    step3Title: "Canjéalo donde quieras",
    step3Body:
      "Paga desde tu depósito virtual con un código QR en cualquier estación asociada — sin depender de una sola marca.",
  },
  guarantee: {
    headline: "La garantía FuelCap",
    item1Label: "El precio sube",
    item1Detail: "Sigues pagando tu precio bloqueado.",
    item2Label: "El precio baja",
    item2Detail: "Se te reembolsa automáticamente.",
    item3Label: "Cambias de opinión",
    item3Detail: "Sin comisiones. Cancela y retira tu dinero cuando quieras.",
    builtFor: "Pensado para",
    audience1: "Quienes se desplazan a diario",
    audience2: "Conductores de VTC y repartidores",
    audience3: "Familias que conducen mucho",
  },
  finalCta: {
    headlineLine1: "Cara ganas tú.",
    headlineLine2: "Cruz ganas tú.",
    body: "Únete al acceso anticipado y bloquea tu primer litro el día que lancemos en tu zona.",
    cta: "Consigue acceso anticipado",
  },
  footer: {
    tagline: "Limita tu precio. Nunca pagues de más.",
    disclaimer:
      "FuelCap está en acceso anticipado. Estamos construyendo la red de estaciones antes del lanzamiento general — únete a la lista de espera para ser de los primeros en tu zona.",
    changeMarket: "¿No estás en este país?",
  },
  stickyCta: "Consigue acceso anticipado — 30 segundos",
  signup: {
    backAria: "Atrás",
    noFeesLine: "Sin spam. Sin comisiones. Cancela cuando quieras.",
    country: {
      eyebrow: "Primero, lo básico",
      question: "¿Dónde vives?",
      options: {
        usa: "Estados Unidos",
        canada: "Canadá",
        uk: "Reino Unido",
        france: "Francia",
        germany: "Alemania",
        spain: "España",
        italy: "Italia",
        austria: "Austria",
        australia: "Australia",
      },
    },
    state: {
      eyebrow: "Ya casi estamos",
      question: "¿Qué estado?",
      options: { nsw: "Nueva Gales del Sur", qld: "Queensland", wa: "Australia Occidental" },
    },
    gender: {
      eyebrow: "Una pregunta rápida para empezar",
      question: "Eres...",
      options: { male: "Hombre", female: "Mujer", unspecified: "Prefiero no decirlo" },
    },
    ageRange: {
      eyebrow: "Esto ya casi no cuenta",
      question: "¿Cuál es tu rango de edad?",
      options: {
        "18-24": "18–24",
        "25-34": "25–34",
        "35-44": "35–44",
        "45-54": "45–54",
        "55-plus": "55+",
      },
    },
    driverType: {
      eyebrow: "Vamos conociéndote",
      question: "¿Qué te describe mejor?",
      options: {
        commuter: "Trayecto diario al trabajo",
        "rideshare-delivery": "Conductor de VTC / repartidor",
        parent: "Madre o padre que conduce mucho",
        other: "Otra cosa",
      },
    },
    fillFrequency: {
      eyebrow: "Última pregunta de opción múltiple, lo prometo",
      question: "¿Con qué frecuencia repostas?",
      options: {
        "1-2": "1–2 veces / mes",
        "3-4": "3–4 veces / mes",
        "5-8": "5–8 veces / mes",
        "9-plus": "9+ veces / mes",
      },
    },
    postal: {
      eyebrow: "Para saber dónde lanzar primero",
      question: "¿Cuál es tu código postal?",
      cta: "Continuar",
      errorInvalid: "Introduce un código postal válido.",
    },
    email: {
      eyebrow: "Último paso — ya estás dentro",
      question: "¿A dónde enviamos tu acceso anticipado?",
      placeholder: "tu@email.com",
      cta: "Consigue acceso anticipado",
      errorInvalid: "Introduce una dirección de correo válida.",
    },
    success: {
      headline: "¡Ya estás en la lista!",
      body: "Te escribiremos en cuanto FuelCap abra en tu zona. Cara ganas tú, cruz ganas tú.",
      done: "Hecho",
    },
  },
};

export default es;
