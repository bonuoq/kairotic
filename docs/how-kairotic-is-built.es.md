<!-- BORRADOR para que Llorenç lo revise y lo reescriba con su voz antes de publicarlo. -->

# Cómo se construye Kairotic

*[Read in English](how-kairotic-is-built.md)*

Kairotic lo hacen un músico y una IA, y prefiero decirlo claramente a que lo descubras en el historial
de commits.

## Quién decide

Soy pianista. Kairotic nace de años de improvisar, enseñar y pensar en cómo trabajamos los músicos con el
tiempo, y las preguntas que se hace son musicales. La dirección del proyecto — para qué sirve, qué debe
llegar a ser, qué ideas avanzan y cuáles esperan — la deciden personas, y hasta ahora sobre todo yo. Esas
decisiones se toman en abierto, en [Discussions](https://github.com/bonuoq/kairotic/discussions): cada
línea de trabajo empieza allí como una idea, allí se discute y allí quedan escritas las decisiones. Si
quieres saber por qué algo es como es, ahí es donde mirar, y ahí es donde puedes cambiarlo.

## Quién escribe el código

Gran parte del código lo escribe [Claude Code](https://claude.com/claude-code), el asistente de
programación de Anthropic, trabajando conmigo en sesiones: yo describo qué debe hacer un ensayo o un
componente y por qué, discutimos el diseño, Claude escribe el código y sus pruebas, y yo lo pruebo, lo
toco y decido. Primero van los ensayos, páginas pequeñas que prueban una idea, y solo lo que se demuestra
pasa a la app.

Lo puedes ver en cada commit que escribe Claude:

- lleva una línea `Co-Authored-By: Claude …`, y
- un enlace `Claude-Session:` a la sesión de la que salió.

No hay nada escondido: la historia del código es la historia de esas conversaciones.

## Qué lo mantiene sólido

- **Pruebas.** Cada cambio llega con sus pruebas, y nada se mezcla hasta que pasan: las pruebas de la app
  se ejecutan en un navegador sin pantalla en cada pull request, los ensayos tienen las suyas, y los motores
  de contrapunto y de reglas se comprueban contra resultados conocidos. Cuando algo se rompe, se añade la
  prueba que lo habría detectado.
- **Pasos pequeños.** El trabajo pasa por pull requests, una idea cada vez, cada una con su discusión.
- **Código abierto.** Todo está bajo la [MPL-2.0](../LICENSE); puedes leerlo, ejecutarlo y cambiarlo entero.

## Tu Claude, no el mío

Kairotic te deja trabajar con Claude dentro de la app — para escribir componentes, construir patches,
responder en canon. Ese Claude es siempre **el tuyo**: en Kairotic Pages usas tu propia clave de API de
Anthropic, guardada en tu navegador; dentro de claude.ai, tu propia cuenta de claude.ai. Ninguna cuenta de
Claude del proyecto se comparte con quienes usan Kairotic, y nada de lo que haces se paga ni se ve a través
de la mía.

## Si contribuyes

Eres bienvenido a trabajar igual, con un asistente de IA o sin él. En los dos casos valen las mismas
reglas: pruebas para lo que cambias, una discusión para lo que cambia la dirección, y tu propia firma en
cada commit ([DCO](../CONTRIBUTING.es.md#certificado-de-origen-del-desarrollador-dco)) — porque quien envía un
cambio responde de él, lo haya tecleado quien lo haya tecleado.

— Llorenç Prats
