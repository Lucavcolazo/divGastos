// Piso de puntos blancos (estilo stipple) con three.js. Cada tecla manda una onda.
import {
  WebGLRenderer, Scene, PerspectiveCamera, BufferGeometry, BufferAttribute,
  ShaderMaterial, Points, Vector2, Vector3, Vector4, Plane, Raycaster,
} from 'three';
import { reduced } from '../lib/dom.js';
import { setRippleHandler } from './ripple.js';

const COLS = 190;
const ROWS = 95;
const GAP = 0.34;
const RIPPLES = 8;

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform vec4 uRip[${RIPPLES}];
  varying float vA;
  void main() {
    vec3 p = position;
    float y = sin(p.x * 0.28 + uTime * 0.5) * 0.35 + sin(p.z * 0.42 - uTime * 0.35) * 0.28;
    float glow = 0.0;
    for (int i = 0; i < ${RIPPLES}; i++) {
      vec4 r = uRip[i];            // x, z, inicio, intensidad
      float age = uTime - r.z;
      if (age > 0.0 && age < 3.5) {
        float d = distance(p.xz, r.xy);
        float front = age * 7.0;
        float k = exp(-pow(d - front, 2.0) * 0.35) * (1.0 - age / 3.5);
        y += r.w * k * 0.8;
        glow += k * r.w;
      }
    }
    p.y += y;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = uSize * (10.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
    float fade = smoothstep(24.0, 8.0, -mv.z) * smoothstep(1.5, 5.0, -mv.z);
    vA = fade * (0.26 + min(glow, 1.0) * 0.5);
  }
`;

const fragmentShader = /* glsl */ `
  varying float vA;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    if (dot(c, c) > 0.25) discard;
    gl_FragColor = vec4(1.0, 1.0, 1.0, vA);
  }
`;

export function initBackground(canvas) {
  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false });
  } catch {
    return; // sin WebGL: la página funciona igual, sin el fondo
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  const scene = new Scene();
  const camera = new PerspectiveCamera(55, 1, 0.1, 100);
  camera.position.set(0, 5, 10);
  camera.lookAt(0, 0, -4);

  const pos = new Float32Array(COLS * ROWS * 3);
  for (let r = 0, n = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++, n += 3) {
      pos[n] = (c - COLS / 2) * GAP;
      pos[n + 1] = 0;
      pos[n + 2] = 6 - r * GAP;
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));

  const uniforms = {
    uTime: { value: 0 },
    uSize: { value: 2.2 * renderer.getPixelRatio() },
    uRip: { value: Array.from({ length: RIPPLES }, () => new Vector4(0, 0, -100, 0)) },
  };
  scene.add(new Points(geo, new ShaderMaterial({ uniforms, vertexShader, fragmentShader, transparent: true, depthWrite: false })));

  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    if (reduced) renderer.render(scene, camera);
  }
  addEventListener('resize', resize);
  resize();

  const t0 = performance.now();
  const now = () => (performance.now() - t0) / 1000;

  // Proyecta el punto de la pantalla sobre el piso para saber dónde nace la onda
  const ray = new Raycaster();
  const floor = new Plane(new Vector3(0, 1, 0), 0);
  const ndc = new Vector2();
  const hit = new Vector3();
  let slot = 0;
  setRippleHandler((x, y, strength) => {
    if (reduced) return;
    ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(floor, hit)) hit.set(0, 0, -10);
    hit.z = Math.max(hit.z, -26);
    uniforms.uRip.value[slot].set(hit.x, hit.z, now(), strength);
    slot = (slot + 1) % RIPPLES;
  });

  if (reduced) {
    renderer.render(scene, camera);
    return;
  }
  renderer.setAnimationLoop(() => {
    if (canvas.style.opacity === '0') return; // no dibuja mientras el hero lo tapa
    uniforms.uTime.value = now();
    renderer.render(scene, camera);
  });
}
