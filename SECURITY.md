# Security

*Castellano más abajo.*

## Reporting a problem

If you find a security problem in Kairotic, please **do not open a public issue or discussion**. Report it
privately, either way:

- through GitHub: **[Report a vulnerability](https://github.com/bonuoq/kairotic/security/advisories/new)**
  (the repository's *Security* tab), or
- by email to **[CONTACT-TO-BE-ADDED]**.

Say what you found, how to reproduce it, and what it could let someone do. You will get an answer within a
week; once it is fixed, the advisory is published and you are credited if you wish.

## What matters most

- **The relay** (`relay/`, `@kairotic/relay`, and the project's own at `kairotic-relay.onrender.com`): anything
  that lets a page or a stranger read or overwrite other people's works and rooms, crash or fill the server,
  make its OSC bridge send to a target it was not started with or accept pages from an origin it was not
  told, or use its signalling (`/signal`) to reach someone outside a room.
- **Your Anthropic API key** in Kairotic Pages: anything that lets it leave your browser for anywhere but
  Anthropic's API, or lets another page or a shared work read it.
- **Shared works and components**: a work, a room or a component from someone else that runs code the
  person opening it did not choose to run (beyond what Kairotic documents: components are code, and
  importing one is trusting it).

Only the latest release and `main` are supported while Kairotic is in alpha.

---

# Seguridad

## Avisar de un problema

Si encuentras un problema de seguridad en Kairotic, por favor **no abras un issue ni una discusión pública**.
Avisa en privado, de una de estas maneras:

- por GitHub: **[Report a vulnerability](https://github.com/bonuoq/kairotic/security/advisories/new)**
  (la pestaña *Security* del repositorio), o
- por correo a **[CONTACT-TO-BE-ADDED]**.

Cuenta qué has encontrado, cómo reproducirlo y qué permitiría hacer. Tendrás respuesta en una semana como
mucho; una vez arreglado, se publica el aviso y se te reconoce si quieres.

## Lo que más importa

- **El relay** (`relay/`, `@kairotic/relay`, y el del proyecto en `kairotic-relay.onrender.com`): cualquier
  cosa que permita a una página o a un desconocido leer o sobrescribir obras y salas ajenas, tumbar o llenar
  el servidor, hacer que su puente OSC envíe a un destino con el que no se arrancó o acepte páginas de un
  origen que no se le indicó, o usar su señalización (`/signal`) para llegar a alguien fuera de una sala.
- **Tu clave de API de Anthropic** en Kairotic Pages: cualquier cosa que la haga salir de tu navegador hacia
  otro sitio que no sea la API de Anthropic, o que permita a otra página o a una obra compartida leerla.
- **Obras y componentes compartidos**: una obra, una sala o un componente de otra persona que ejecute código
  que quien lo abre no ha elegido ejecutar (más allá de lo que documenta Kairotic: los componentes son
  código, e importar uno es confiar en él).

Mientras Kairotic esté en alfa, solo se mantienen la última versión publicada y `main`.
