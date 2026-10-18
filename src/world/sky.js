// Moving night sky: gradient, drifting aurora, twinkling stars and a striped neon moon.
import * as THREE from 'three';

const vertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww; // always at the far plane
  }
`;

const fragment = /* glsl */ `
  uniform float uTime;
  varying vec3 vDir;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 top = vec3(0.004, 0.0, 0.03);
    vec3 mid = vec3(0.06, 0.01, 0.14);
    vec3 hor = vec3(0.32, 0.04, 0.30);
    vec3 col = mix(hor, mid, smoothstep(0.0, 0.22, h));
    col = mix(col, top, smoothstep(0.22, 0.75, h));
    if (h < 0.0) col = mix(hor, vec3(0.02, 0.0, 0.04), smoothstep(0.0, -0.25, h));

    // Aurora ribbons drifting across the sky.
    float band = sin(d.x * 5.0 + uTime * 0.12 + sin(d.z * 3.0 + uTime * 0.07) * 2.5) * 0.5 + 0.5;
    float aur = smoothstep(0.12, 0.4, h) * (1.0 - smoothstep(0.45, 0.85, h)) * pow(band, 4.0);
    col += mix(vec3(0.0, 0.55, 0.65), vec3(0.6, 0.1, 0.8), d.x * 0.5 + 0.5) * aur * 0.4;

    // Stars.
    vec3 sp = floor(d * 240.0);
    float s = hash(sp);
    float star = step(0.9968, s) * smoothstep(0.06, 0.3, h);
    col += vec3(star * (0.55 + 0.45 * sin(uTime * 2.5 + s * 90.0)));

    // Striped neon moon on the horizon, ahead of the runner.
    vec3 md = normalize(vec3(0.18, 0.13, -1.0));
    float m = dot(d, md);
    float disc = smoothstep(0.9955, 0.9962, m);
    float rel = d.y - md.y;
    float cut = step(0.0, rel) + step(0.0, sin(rel * 420.0 - uTime * 1.5)) * smoothstep(-0.09, 0.0, rel);
    vec3 moon = mix(vec3(1.0, 0.18, 0.55), vec3(1.0, 0.8, 0.3), smoothstep(-0.08, 0.08, rel)) * 2.2;
    col = mix(col, moon, disc * clamp(cut, 0.0, 1.0));
    col += vec3(1.0, 0.25, 0.6) * pow(max(m, 0.0), 300.0) * 0.5;

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export class Sky {
  constructor(scene) {
    this.uniforms = { uTime: { value: 0 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: vertex,
      fragmentShader: fragment,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), mat);
    this.mesh.renderOrder = -1;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  update(time, camera) {
    this.uniforms.uTime.value = time;
    this.mesh.position.copy(camera.position);
  }
}
