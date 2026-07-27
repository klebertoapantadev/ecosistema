import { crearManejadorCallbackOAuth } from "@eco/identidad";

// Destino del redirectTo de signInWithOAuth (Google). Logica compartida por
// los 4 negocios -- ver packages/identidad/src/servidor.ts.
export const GET = crearManejadorCallbackOAuth("margaritas");
