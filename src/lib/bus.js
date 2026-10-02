// Bus de eventos mínimo para que los módulos no dependan entre sí.
//
// item:added    (item)  se agregó un gasto
// item:updated  (item)  se editó un gasto
// items:changed         se borró uno, se cortó el ticket o se restauró
// entry:changed         cambió lo que se está tipeando en la calculadora
// split:changed (n)     cambió entre cuántos se divide
// edit:request  (id)    se pidió editar un gasto (click en el ticket)

const bus = new EventTarget();

export const on = (type, fn) => bus.addEventListener(type, e => fn(e.detail));
export const emit = (type, detail) => bus.dispatchEvent(new CustomEvent(type, { detail }));
