// Renderer with two quality levels.
// High: bloom glow + multisampled smoothing + sharper pixels. Low: plain render, 1x pixels.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export const FOG_COLOR = 0x2a0a36;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      stencil: false,
      powerPreference: 'high-performance',
    });
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.toneMapping = THREE.ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 1.15;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(FOG_COLOR, 35, 210);
    this.scene.background = new THREE.Color(FOG_COLOR);
    this.camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.1, 600);

    this.quality = 'high';
    this.composer = null;
    this.bloom = null;
    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
  }

  setQuality(q) {
    this.quality = q === 'low' ? 'low' : 'high';
    if (this.quality === 'high' && !this.composer) this._buildComposer();
    this.resize();
  }

  _buildComposer() {
    const size = this.gl.getDrawingBufferSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(size.x || 1, size.y || 1, {
      type: THREE.HalfFloatType,
      samples: 4, // multisampled smoothing
    });
    this.composer = new EffectComposer(this.gl, target);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.85, 0.55, 0.62);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const ratio = this.quality === 'high' ? Math.min(window.devicePixelRatio || 1, 1.75) : 1;
    this.gl.setPixelRatio(ratio);
    this.gl.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.composer) {
      this.composer.setPixelRatio(ratio);
      this.composer.setSize(w, h);
      // Bloom at half resolution is plenty and much cheaper.
      this.bloom.resolution.set((w * ratio) / 2, (h * ratio) / 2);
    }
  }

  render() {
    if (this.quality === 'high' && this.composer) this.composer.render();
    else this.gl.render(this.scene, this.camera);
  }
}
