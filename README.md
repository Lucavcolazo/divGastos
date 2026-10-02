# Divisor de gastos

Calculadora para cargar los gastos del mes (alquiler, servicios, ocio…) y dividirlos entre los que viven en el depto. Cada gasto sale impreso en un ticket que se va haciendo más largo.

## Cómo se usa

- **Cargar un gasto:** elegí la categoría, escribí el concepto y el monto, y tocá **↵ imprimir** (o Enter).
- **Teclado:** números y coma van al monto, Enter imprime, Esc limpia, Backspace borra un dígito. Si empezás a escribir letras, van al concepto.
- **Editar:** tocá una línea del ticket. Se carga en la calculadora y el botón pasa a **guardar**.
- **Borrar una línea:** la × que aparece al pasar el mouse.
- **Dividir entre N:** el selector `÷ − 2 +` del resumen (de 1 a 20).
- **Cortar el ticket (borrar todo):** hacé scroll hacia abajo sobre la impresora, o arrastrala en el celular, hasta llegar al 100%. Abajo aparece **deshacer** por unos segundos.

Los datos se guardan en el `localStorage` del navegador.

## Desarrollo

Requiere Node 20 o más nuevo.

```bash
npm install
npm run dev       # servidor local con recarga en vivo
npm run build     # genera el sitio estático en dist/
npm run preview   # sirve dist/ para probar el build
```

## Estructura

```
index.html               markup de la página
public/favicon.svg
src/
  main.js                punto de entrada: estilos + inicializa cada módulo
  state.js               estado (gastos, división, entrada) y acciones que lo modifican
  lib/
    bus.js               eventos entre módulos (item:added, split:changed, …)
    storage.js           persistencia en localStorage
    format.js            formato de montos es-AR
    dom.js               helpers de DOM y animación
  features/
    background.js        piso de puntos con three.js (se carga aparte)
    ripple.js            ondas del fondo al tocar teclas
    hero.js              parallax del hero y scroll a la calculadora
    summary.js           resumen: lo que se carga, total y cada uno
    calculator.js        teclado, pantalla y categorías
    printer.js           ticket: impresión, edición, borrar, cortar tirando
    toast.js             aviso con acción (deshacer)
    keyboard.js          atajos del teclado físico
  styles/                un CSS por sección (base, hero, summary, desk, printer, calculator, toast)
  assets/hero-enter.png  imagen del hero
```

Los módulos no se llaman entre sí para avisar cambios: modifican el estado con las acciones de `state.js`, que emiten eventos por `bus.js`, y cada módulo escucha los que le importan.

## Deploy

`vite.config.js` usa `base: './'`, así que el contenido de `dist/` funciona tal cual en GitHub Pages, Vercel, Netlify o cualquier hosting estático.
