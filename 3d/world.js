// The living landscape: sky, light, terrain, water, plants, mountains and cities. Rebuilt on every teleport.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { fbm, ridged, sstep, rng, vnoise } from './noise.js';
import { heightFn, TIMES } from './lands.js';
import { plantGeometry, grassGeometry, PLANT_RULES } from './plants.js';

const NOISE_GLSL = `
float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
float fbm2(vec2 p){ float s=0.,a=.5; for(int i=0;i<4;i++){ s+=a*vn(p); p=p*2.03+17.1; a*=.5; } return s; }
`;

export class World {
  constructor(renderer, quality) {
    this.r = renderer; this.q = quality; this.scene = new THREE.Scene(); this.time = 0;
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.sky = new Sky(); this.sky.scale.setScalar(20000); this.sky.renderOrder = -10;
    this.skyScene = new THREE.Scene(); this.skyScene.add(this.sky);
    this.skyMain = new THREE.Mesh(this.sky.geometry, this.sky.material); this.skyMain.scale.setScalar(20000); this.skyMain.frustumCulled = false; this.scene.add(this.skyMain);
    this.cubeRT = new THREE.WebGLCubeRenderTarget(quality.hi ? 256 : 128, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    this.cubeCam = new THREE.CubeCamera(1, 30000, this.cubeRT); this.cubeCam.position.set(0, 20, 0);
    this.sun = new THREE.DirectionalLight(0xffffff, 3); this.sun.castShadow = true;
    const sm = quality.hi ? 4096 : 1536; this.sun.shadow.mapSize.set(sm, sm);
    Object.assign(this.sun.shadow.camera, { left: -95, right: 95, top: 95, bottom: -95, near: 10, far: 1400 });
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.6;
    this.hemi = new THREE.HemisphereLight(0xbfd4ff, 0x445533, 0.6);
    this.sunDir = new THREE.Vector3();
    this.night = 0; this.uniforms = { uTime: { value: 0 }, uNight: { value: 0 } };
    this.group = null; this.instances = [];
  }

  prep(L) { if (this.L !== L || !this.h || this.h.padded) { this.L = L; this.h = heightFn(L); this.hasWater = !L.noWater; } }
  height(x, z) { return this.h(x, z); }
  slope(x, z) { const e = 1.5; return Math.hypot(this.h(x + e, z) - this.h(x - e, z), this.h(x, z + e) - this.h(x, z - e)) / (2 * e); }
  isWater(x, z) { return this.hasWater && this.h(x, z) < 0.6; }

  build(L, timeId) {
    if (this.group) { this.scene.remove(this.group); this.group.traverse(o => { o.geometry?.dispose(); if (o.material && !o.material.shared) [].concat(o.material).forEach(m => m.dispose()); }); }
    this.L = L; this.hasWater = !L.noWater; this.instances = [];
    const raw = heightFn(L), pad = this.pad && this.pad.L === L ? this.pad : null; this.pad = null;
    if (pad) { const py = Math.max(raw(pad.x, pad.z), this.hasWater ? 2 : -1e9); // grade a level building pad into the hillside
      this.h = (x, z) => { const d = Math.hypot(x - pad.x, z - pad.z); if (d > 70) return raw(x, z); const t = d < 30 ? 0 : (d - 30) / 40, k = t * t * (3 - 2 * t); return py + (raw(x, z) - py) * k; }; this.h.padded = true;
    } else this.h = raw;
    const g = this.group = new THREE.Group(); this.scene.add(g);
    g.add(this.sun, this.sun.target, this.hemi);
    this.buildTerrain(); this.buildMountains();
    if (this.hasWater) this.buildWater();
    this.buildPlants(); this.buildGrass();
    if (L.city) this.buildCity();
    (L.extras || []).forEach(e => this['extra_' + e]?.());
    this.setTime(timeId);
  }

  // ---------- sky & light ----------
  setTime(timeId) {
    const L = this.L, T = TIMES[timeId] || TIMES.golden; this.timeId = timeId;
    const elev = THREE.MathUtils.degToRad(T.elev), az = THREE.MathUtils.degToRad(L.sunAz);
    this.sunDir.set(Math.sin(az) * Math.cos(elev), Math.sin(elev), -Math.cos(az) * Math.cos(elev)).normalize();
    const u = this.sky.material.uniforms;
    u.sunPosition.value.copy(this.sunDir); u.turbidity.value = L.sky.turb * (timeId === 'day' ? 0.8 : 1.15); u.rayleigh.value = L.sky.ray * (timeId === 'dusk' ? 1.6 : 1);
    u.mieCoefficient.value = timeId === 'day' ? 0.004 : 0.008; u.mieDirectionalG.value = 0.86;
    u.cloudCoverage.value = L.sky.cov; u.cloudDensity.value = 0.55; u.cloudScale.value = 0.00022; u.cloudElevation.value = 0.55; u.cloudSpeed.value = 0.00008;
    this.night = timeId === 'dusk' ? 1 : timeId === 'golden' ? 0.25 : 0; this.uniforms.uNight.value = this.night;
    const sc = { day: [0xfff4e6, 3.4], golden: [0xffb070, 3.0], dusk: [0x9aa6e0, 0.5] }[timeId];
    this.sun.color.set(sc[0]); this.sun.intensity = sc[1];
    const ld = this.sunDir.clone(); if (ld.y < 0.12) ld.y = 0.12; ld.normalize(); this.lightDir = ld;
    this.hemi.intensity = { day: 0.9, golden: 0.7, dusk: 0.55 }[timeId];
    this.refreshEnv();
    this.hemi.color.copy(this.fogColor).multiplyScalar(1 / Math.max(0.05, (this.fogColor.r + this.fogColor.g + this.fogColor.b) / 3)).lerp(new THREE.Color(0xd8e2f0), 0.55); this.hemi.groundColor.set(L.pal.grass).multiplyScalar(0.5);
    this.exposure = { day: 0.42, golden: 0.5, dusk: 0.95 }[timeId];
    this.r.toneMappingExposure = this.exposure;
    if (this.water) { const wu = this.water.material.uniforms; wu.uSunDir.value.copy(this.sunDir); wu.uSunColor.value.copy(this.sun.color).multiplyScalar(timeId === 'dusk' ? 0.4 : this.sun.intensity * 0.9); }
    this.onTime?.();
  }
  refreshEnv() {
    const sd = this.sky.material.uniforms.showSunDisc; const sdv = sd.value; sd.value = 0; this.cubeCam.update(this.r, this.skyScene); sd.value = sdv; // the HDR disc poisons PMREM with NaNs
    this.envRT?.dispose(); this.envRT = this.pmrem.fromCubemap(this.cubeRT.texture);
    this.scene.environment = this.envRT.texture; this.scene.environmentIntensity = this.timeId === 'dusk' ? 0.7 : 0.9;
        // fog colour = the sky at the horizon looking at the view
    const rt = new THREE.WebGLRenderTarget(8, 8, { type: THREE.FloatType }); const cam = new THREE.PerspectiveCamera(30, 1, 1, 30000);
    const su = this.sky.material.uniforms, disc = su.showSunDisc.value; su.showSunDisc.value = 0; cam.position.set(0, 20, 0);
    let r = 0, g = 0, b = 0; const px = new Float32Array(8 * 8 * 4), dirs = [[-0.3, -1], [0.7, -0.7], [-0.9, -0.4], [1, 0.2]];
    for (const [dx, dz] of dirs) { cam.lookAt(dx * 10, 20.5, dz * 10); this.r.setRenderTarget(rt); this.r.render(this.skyScene, cam);
      try { this.r.readRenderTargetPixels(rt, 0, 0, 8, 8, px); } catch (e) { px.fill(0.5); }
      for (let i = 0; i < 64; i++) { r += Math.min(px[i * 4], 8); g += Math.min(px[i * 4 + 1], 8); b += Math.min(px[i * 4 + 2], 8); } }
    this.r.setRenderTarget(null); rt.dispose(); su.showSunDisc.value = disc; r /= 4; g /= 4; b /= 4;
    const fc = new THREE.Color(r / 64, g / 64, b / 64); if (!(fc.r + fc.g + fc.b > 0)) fc.set(0.6, 0.7, 0.8); this.skyLum = (fc.r + fc.g + fc.b) / 3; if (this.skyLum > 1.5) fc.multiplyScalar(1.5 / this.skyLum);
    if (this.L.fogTint) fc.lerp(new THREE.Color(this.L.fogTint).multiplyScalar(fc.r + fc.g + fc.b), 0.45);
    this.fogColor = fc; this.scene.fog = new THREE.FogExp2(fc, this.L.fog);
    if (this.water) { this.water.material.uniforms.uFog.value.copy(fc); this.water.material.uniforms.uEnv.value = this.cubeRT.texture; }
  }

  // ---------- terrain ----------
  terrainColor(x, y, z, s, out) {
    const P = this.pal; const n = fbm(x * 0.02, z * 0.02, 3), n2 = vnoise(x * 0.15, z * 0.15);
    out.copy(P.grass).lerp(P.grass2, sstep(-0.3, 0.5, n));
    if (this.L.grass === 'dry') out.lerp(P.dirt, 0.25 + 0.2 * n2);
    const rock = sstep(0.55, 0.95, s + 0.15 * n); out.lerp(P.rock, rock);
    if (this.hasWater) { const sand = 1 - sstep(this.L.type === 'coast' ? 1.5 : 0.8, this.L.type === 'coast' ? 4.5 : 1.8, y + n * 1.5); out.lerp(P.sand, sand); if (y < 0) out.lerp(P.sand, 1).multiplyScalar(0.75); }
    if (this.L.city && y < this.L.t.floor + 4) out.lerp(new THREE.Color('#5a5650'), 0.75);
    out.multiplyScalar(0.9 + 0.12 * n2);
    return out;
  }
  terrainMesh(size, seg, lowerInside) {
    const geo = new THREE.PlaneGeometry(size, size, seg, seg); geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i); let y = this.h(x, z);
      if (lowerInside) { const m = Math.max(Math.abs(x), Math.abs(z)); y -= 1.2 * (1 - sstep(lowerInside - 20, lowerInside, m)); }
      p.setY(i, y);
    }
    geo.computeVertexNormals(); const nn = geo.attributes.normal;
    for (let i = 0; i < p.count; i++) { const s = Math.sqrt(1 - nn.getY(i) ** 2) / Math.max(nn.getY(i), 0.05); this.terrainColor(p.getX(i), p.getY(i), p.getZ(i), Math.min(s, 2), c); col.set([c.r, c.g, c.b], i * 3); }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
    mat.onBeforeCompile = sh => {
      sh.vertexShader = 'varying vec3 vWp;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vWp = (modelMatrix*vec4(transformed,1.)).xyz;');
      sh.fragmentShader = 'varying vec3 vWp;\n' + NOISE_GLSL + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n float dn = fbm2(vWp.xz*0.35)*0.6 + fbm2(vWp.xz*2.1)*0.4; diffuseColor.rgb *= 0.78 + 0.42*dn;');
    };
    const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; return m;
  }
  buildTerrain() {
    const P = this.L.pal; this.pal = Object.fromEntries(Object.entries(P).map(([k, v]) => [k, new THREE.Color(v)]));
    const near = this.q.hi ? 300 : 150;
    this.terrain = this.terrainMesh(600, near); this.group.add(this.terrain);
    const far = this.terrainMesh(5200, this.q.hi ? 260 : 140, 290); far.receiveShadow = false; this.group.add(far);
    // height texture for water depth / foam
    if (this.hasWater) {
      const N = 512, E = 1300, data = new Uint16Array(N * N);
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) data[j * N + i] = THREE.DataUtils.toHalfFloat(this.h((i + 0.5) / N * 2 * E - E, (j + 0.5) / N * 2 * E - E));
      this.hTex?.dispose(); this.hTex = new THREE.DataTexture(data, N, N, THREE.RedFormat, THREE.HalfFloatType); this.hTex.magFilter = this.hTex.minFilter = THREE.LinearFilter; this.hTex.needsUpdate = true; this.hExt = E;
    }
  }
  buildMountains() {
    const M = this.L.mountains, V = this.L.volcano; if (!M && !V) return;
    const A = this.q.hi ? 420 : 220, R = 26, R0 = M?.near ? 650 : 1300, R1 = 5200, H = M?.h || 0;
    const pos = [], col = [], idx = [], c = new THREE.Color(), rock = this.pal.rock.clone().lerp(new THREE.Color('#7a7f88'), 0.4), snow = new THREE.Color('#f4f7fb');
    const shore = this.L.t.shore;
    for (let j = 0; j <= R; j++) for (let i = 0; i <= A; i++) {
      const a = i / A * Math.PI * 2, r = R0 + (R1 - R0) * (j / R) ** 1.3, x = Math.sin(a) * r, z = -Math.cos(a) * r;
      let mask = 1;
      if (M?.land) mask = sstep(shore + 200, shore + 900, z) + sstep(900, 1800, Math.abs(x)) * sstep(shore - 600, shore + 200, z);
      if (M?.arc) mask *= sstep(M.arc[0] - 0.4, M.arc[0], a > Math.PI ? a - 2 * Math.PI : a) * (1 - sstep(M.arc[1], M.arc[1] + 0.4, a > Math.PI ? a - 2 * Math.PI : a)) * 0.85 + 0.15;
      const prof = sstep(R0, R0 + (M?.near ? 500 : 900), r) * (1 - 0.35 * sstep(R1 * 0.6, R1, r));
      let y = H * prof * mask * (M?.jag ? 0.25 + 0.95 * ridged(Math.cos(a) * 3 + r * 0.0007, Math.sin(a) * 3 + r * 0.0005, 6) : 0.3 + 0.7 * (fbm(Math.cos(a) * 2.2 + 4, Math.sin(a) * 2.2 + r * 0.0004, 5) * 0.5 + 0.55));
      if (V) { const d = Math.hypot(x - V.x, z - V.z) / V.r; y = Math.max(y, V.h * Math.max(0, 1 - d) ** 1.4 * (1 + 0.05 * fbm(x * 0.004, z * 0.004, 3)) - 40); }
      y += this.h(Math.max(-2500, Math.min(2500, x)), Math.max(-2500, Math.min(2500, z))) * 0.0 - (this.hasWater && this.L.type === 'coast' ? 20 : 0);
      pos.push(x, y, z);
      const sline = (M?.snow ?? 0.7) * (H || (V?.h ?? 0)) * (0.9 + 0.25 * vnoise(x * 0.004, z * 0.004));
      c.copy(this.pal.grass).multiplyScalar(0.7).lerp(rock, sstep(80, 400, y)).lerp(snow, sstep(sline - 60, sline + 40, y) * (V && y > V.h * 0.45 ? 1 : 1));
      col.push(c.r, c.g, c.b);
    }
    for (let j = 0; j < R; j++) for (let i = 0; i < A; i++) { const a = j * (A + 1) + i, b = a + 1, d = a + A + 1, e = d + 1; idx.push(a, d, b, b, d, e); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide })); this.group.add(m);
  }

  // ---------- water ----------
  buildWater() {
    const W = this.L.water, geo = new THREE.PlaneGeometry(14000, 14000, this.q.hi ? 360 : 180, this.q.hi ? 360 : 180); geo.rotateX(-Math.PI / 2);
    // densify near the centre: squash vertices toward origin
    const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i) / 7000, z = p.getZ(i) / 7000; const f = (v) => Math.sign(v) * Math.pow(Math.abs(v), 2.2) * 7000; p.setX(i, f(x)); p.setZ(i, f(z)); }
    const mat = new THREE.ShaderMaterial({
      transparent: true, fog: false,
      uniforms: { ...this.uniforms, uSunDir: { value: new THREE.Vector3() }, uSunColor: { value: new THREE.Color() }, uDeep: { value: new THREE.Color(W.deep) }, uShallow: { value: new THREE.Color(W.shallow) }, uAmp: { value: W.amp }, uFoamK: { value: W.foam }, uFlow: { value: W.flow || 0 }, uH: { value: this.hTex }, uHExt: { value: this.hExt }, uEnv: { value: this.cubeRT.texture }, uFog: { value: new THREE.Color() }, uFogD: { value: this.L.fog } },
      vertexShader: `uniform float uTime,uAmp,uHExt; uniform sampler2D uH; varying vec3 vW; varying float vDepth;
        float th(vec2 p){ vec2 uv=p/(2.*uHExt)+.5; if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.)))) return -40.; return texture2D(uH,uv).r; }
        void main(){ vec4 w=modelMatrix*vec4(position,1.); float d=-th(w.xz); vDepth=d; float att=smoothstep(0.,10.,d)*uAmp;
          vec3 p=w.xyz; for(int i=0;i<3;i++){ float fi=float(i); vec2 D=normalize(vec2(cos(fi*1.9+.4),sin(fi*1.9+.4)-1.2)); float L=70.-fi*18.; float k=6.2831/L; float c=sqrt(9.8/k); float A=0.55/k*0.5; float f=k*(dot(D,w.xz)-c*uTime);
            p.x+=0.6*A*D.x*cos(f)*att; p.z+=0.6*A*D.y*cos(f)*att; p.y+=A*sin(f)*att; }
          vW=p; gl_Position=projectionMatrix*viewMatrix*vec4(p,1.); }`,
      fragmentShader: `uniform float uTime,uAmp,uFoamK,uFlow,uNight,uFogD; uniform vec3 uSunDir,uSunColor,uDeep,uShallow,uFog; uniform samplerCube uEnv; varying vec3 vW; varying float vDepth;
        ${NOISE_GLSL}
        void main(){
          vec3 V=normalize(cameraPosition-vW); float dist=length(cameraPosition-vW);
          float att=smoothstep(0.,6.,vDepth)*0.8+0.2; vec2 p=vW.xz; vec3 n=vec3(0.,1.,0.); float crest=0.;
          float amp=max(uAmp,0.05)*att;
          float lod=1.-smoothstep(300.,2500.,dist);
          for(int i=0;i<14;i++){ float fi=float(i); float ang=fi*2.399; vec2 D=normalize(vec2(cos(ang),sin(ang))+vec2(uFlow*1.5,-0.8)); float L=40.*pow(0.76,fi)+0.35; float k=6.2831/L; float c=sqrt(9.8/k)*(1.+uFlow*0.6);
            float steep=(0.11-fi*0.004)*smoothstep(dist*0.004,dist*0.012,L); float A=steep/k; float f=k*(dot(D,p)-c*uTime)+fi*1.7; n.xz-=D*k*A*cos(f)*amp; crest+=A*k*sin(f)*(i<5?1.:0.4); }
          vec2 rp=p*vec2(0.6,0.6)+vec2(uTime*0.4*(1.+uFlow*3.),uTime*0.1); n.xz+= (vec2(fbm2(rp*3.),fbm2(rp*3.+7.))-.5)*0.18*(1.-smoothstep(30.,260.,dist));
          n=normalize(n);
          float F=0.02+0.98*pow(1.-max(dot(n,V),0.),5.);
          vec3 R=reflect(-V,n); R.y=abs(R.y); vec3 refl=textureCube(uEnv,R).rgb;
          float day=clamp(uSunDir.y*3.+0.25,0.05,1.);
          vec3 body=mix(uShallow,uDeep,smoothstep(0.,14.,vDepth))*day*(0.35+0.65*max(dot(n,normalize(uSunDir+vec3(0,.3,0))),0.));
          body+=uShallow*0.25*day*smoothstep(0.2,1.2,crest)*max(dot(-V.xz,uSunDir.xz),0.);
          vec3 col=mix(body,refl,F);
          vec3 H=normalize(uSunDir+V); float sp=pow(max(dot(n,H),0.),420.)*2.5+pow(max(dot(n,H),0.),2400.)*14.;
          col+=uSunColor*sp*step(-0.02,uSunDir.y);
          float fn=fbm2(p*0.45+vec2(uTime*0.2,0.))*0.6+fbm2(p*1.7-uTime*0.3)*0.4;
          float shore=(1.-smoothstep(0.,1.8+2.5*fn,vDepth))*(0.55+0.45*sin(vDepth*2.6-uTime*1.6+fn*6.));
          float caps=smoothstep(0.85,1.25,crest+fn*0.6)*uFoamK*smoothstep(4.,12.,vDepth);
          float foam=clamp(shore*uFoamK*1.2+caps,0.,1.)*smoothstep(0.62,0.4,fn*0.3+0.3)*1.4; foam=clamp(foam,0.,1.);
          vec3 foamCol=vec3(0.95)*(day*(0.6+0.5*max(uSunDir.y,0.))+0.08)+uSunColor*0.08;
          col=mix(col,foamCol,foam);
          float alpha=clamp(mix(0.25,1.,smoothstep(0.,3.,vDepth))+foam,0.,1.);
          float fogF=1.-exp(-uFogD*uFogD*dist*dist); col=mix(col,uFog,fogF);
          gl_FragColor=vec4(col,alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.water = new THREE.Mesh(geo, mat); this.water.renderOrder = 2; this.water.frustumCulled = false; this.group.add(this.water);
  }

  // ---------- plants ----------
  windMaterial(opts = {}) {
    const { windK, ...mo } = opts; const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide, ...mo }); mat.customProgramCacheKey = () => 'wind' + windK;
    const U = this.uniforms;
    mat.onBeforeCompile = sh => {
      sh.uniforms.uTime = U.uTime;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
        vec2 ip = instanceMatrix[3].xz; float sway = sin(uTime*1.3 + ip.x*0.05 + ip.y*0.07)*0.5+sin(uTime*2.7+ip.x*0.3)*0.25;
        transformed.x += sway * ${windK || '0.012'} * transformed.y * transformed.y / (1.+transformed.y*0.08);
        #endif`);
    };
    return mat;
  }
  scatter(kind, count, rule, seed) {
    const [maxS, minH, s0, s1, rad] = rule, R = rng(seed), out = [];
    let tries = 0;
    while (out.length < count && tries++ < count * 12) {
      const a = R() * Math.PI * 2, r = Math.sqrt(R()) * rad, x = Math.sin(a) * r, z = Math.cos(a) * r - (this.L.type === 'city' ? 0 : 60);
      const y = this.h(x, z); if (this.hasWater && y < minH) continue; if (this.slope(x, z) > maxS) continue;
      if (this.L.city && y < this.L.t.floor + 6) continue;
      if (kind !== 'palm' && kind !== 'boulder' && this.hasWater && this.L.type === 'coast' && y < 4) continue;
      if (fbm(x * 0.01 + seed, z * 0.01, 2) < (kind === 'shrub' || kind === 'boulder' ? -0.25 : -0.1)) continue; // clumping
      out.push([x, y - 0.3, z, s0 + (s1 - s0) * R() ** 2, R() * 6.28]);
    }
    return out;
  }
  addInstanced(geo, mat, items, cast, recv = true) {
    const m = new THREE.InstancedMesh(geo, mat, items.length); const o = new THREE.Object3D(), c = new THREE.Color();
    items.forEach(([x, y, z, s, rot], i) => { o.position.set(x, y, z); o.rotation.set(0, rot, 0); o.scale.setScalar(s); o.updateMatrix(); m.setMatrixAt(i, o.matrix); c.setHSL(0, 0, 0.82 + 0.3 * ((i * 0.618) % 1)); m.setColorAt(i, c); });
    m.castShadow = cast; m.receiveShadow = recv; m.userData.items = items; m.frustumCulled = false;
    this.group.add(m); this.instances.push(m); return m;
  }
  buildPlants() {
    let seed = 11; const k = this.q.hi ? 1 : 0.45;
    for (const [kind, n] of this.L.plants) {
      const items = this.scatter(kind, Math.round(n * k), PLANT_RULES[kind], seed += 101);
      const geo = plantGeometry(kind);
      this.addInstanced(geo, kind === 'boulder' ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }) : this.windMaterial({ windK: kind === 'palm' ? '0.004' : kind === 'redwood' ? '0.0004' : '0.006' }), items, kind !== 'fern' && kind !== 'shrub');
    }
  }
  buildGrass() {
    const G = { dry: ['#d6c27a', '#7e7440'], lush: ['#8dbb52', '#2f5a24'], meadow: ['#b7c45c', '#4a6a2c'] }[this.L.grass] || ['#8dbb52', '#2f5a24'];
    const geo = grassGeometry(G[0], G[1]); const n = this.q.hi ? 42000 : 9000, R = rng(7), items = [];
    let tries = 0;
    while (items.length < n && tries++ < n * 6) {
      const a = R() * 6.283, r = Math.sqrt(R()) * 190, x = Math.sin(a) * r, z = Math.cos(a) * r;
      const y = this.h(x, z); if (this.hasWater && y < (this.L.type === 'coast' ? 4.2 : 1.6)) continue; if (this.slope(x, z) > 0.55) continue;
      if (fbm(x * 0.03, z * 0.03, 2) < -0.2) continue;
      items.push([x, y - 0.05, z, 0.8 + R() * 0.9, R() * 6.28]);
    }
    const m = this.addInstanced(geo, this.windMaterial({ windK: '0.08', roughness: 1 }), items, false); m.userData.grass = true;
  }
  clearAround(x, z, r) { // hide plants under the house
    const o = new THREE.Object3D();
    for (const m of this.instances) {
      m.userData.items.forEach(([px, py, pz, s, rot], i) => { const hide = (px - x) ** 2 + (pz - z) ** 2 < (r + (m.userData.grass ? 0 : 3 * s)) ** 2; o.position.set(px, py, pz); o.rotation.set(0, rot, 0); o.scale.setScalar(hide ? 0 : s); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
      m.instanceMatrix.needsUpdate = true;
    }
  }

  // ---------- cities ----------
  windowMaterial(neon) {
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.4 });
    const U = this.uniforms;
    mat.onBeforeCompile = sh => {
      sh.uniforms.uNight = U.uNight;
      sh.vertexShader = 'varying vec3 vWp; varying vec3 vLn; varying vec2 vId;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vWp=(modelMatrix*instanceMatrix*vec4(transformed,1.)).xyz; vLn=normal; vId=instanceMatrix[3].xz;');
      sh.fragmentShader = 'uniform float uNight; varying vec3 vWp; varying vec3 vLn; varying vec2 vId;\n' + NOISE_GLSL + sh.fragmentShader
        .replace('#include <color_fragment>', `#include <color_fragment>
          float side=step(abs(vLn.y),0.5); float u=abs(vLn.x)>0.5?vWp.z:vWp.x; vec2 cell=floor(vec2(u/3.1,vWp.y/3.7));
          vec2 fr=fract(vec2(u/3.1,vWp.y/3.7)); float win=side*step(0.18,fr.x)*step(fr.x,0.82)*step(0.25,fr.y)*step(fr.y,0.8);
          float on=step(0.74,h21(cell+vId*0.13)); float dfade=1.-smoothstep(500.,2200.,length(vWp-cameraPosition)); win*=mix(0.35,1.,dfade); diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.06,0.08,0.1),win*0.85);
          vec3 wcol=mix(vec3(1.,0.72,0.42),vec3(0.75,0.85,1.),step(0.8,h21(cell*1.7+vId)));
          vec3 glow=win*on*wcol*(uNight*0.9+0.02);
          ${neon ? `float band=side*step(0.86,h21(floor(vId*0.07)))*step(fract(vWp.y/9.),0.18)*step(10.,vWp.y); glow+=band*uNight*3.*mix(vec3(1.,.2,.6),vec3(.2,.8,1.),h21(vId));` : ''}`)
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += glow;')
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, 0.08, win);');
    };
    return mat;
  }
  buildCity() {
    const C = this.L.city, k = this.L.t, R = rng(99), items = [], lights = [];
    const step = C.kind === 'sprawl' ? 30 : 42;
    for (let z = -k.edge1 - 90; z > -2600; z -= step) for (let x = -2200; x < 2200; x += step) {
      if (R() > C.density) continue;
      let hmax = C.max, hmin = C.min, fx = x + (R() - 0.5) * 8, fz = z + (R() - 0.5) * 8;
      if (C.downtown) { const d = Math.hypot(fx - C.downtown.x, fz - C.downtown.z); if (d < 320) { hmin = 50; hmax = 230; } }
      else { const d = Math.hypot(fx * 0.6, fz + 900); hmax = C.min + (C.max - C.min) * Math.max(0.12, 1 - d / 1400); }
      const y = this.h(fx, fz); if (y > k.floor + 8) continue;
      const w = (C.kind === 'sprawl' ? 10 : 18) + R() * (C.kind === 'sprawl' ? 14 : 18), d = w * (0.7 + R() * 0.6), h = hmin + (hmax - hmin) * R() ** 2.2;
      items.push([fx, y, fz, w, h, d]);
      for (let i = 0; i < 3; i++) lights.push([x + (R() - 0.5) * step, y + 1, z + step / 2]);
    }
    const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
    const m = new THREE.InstancedMesh(geo, this.windowMaterial(C.kind === 'neon'), items.length), o = new THREE.Object3D(), c = new THREE.Color();
    const tones = C.kind === 'sprawl' ? ['#e9dccb', '#d9c8b0', '#c9c2b8', '#efe6d8'] : ['#9aa4ae', '#c8c0b2', '#7f8a96', '#b5aa98', '#5d6a78', '#d8d0c4'];
    items.forEach(([x, y, z, w, h, d], i) => { o.position.set(x, y - 2, z); o.scale.set(w, h + 2, d); o.rotation.set(0, 0, 0); o.updateMatrix(); m.setMatrixAt(i, o.matrix); m.setColorAt(i, c.set(tones[i % tones.length])); });
    m.castShadow = false; m.receiveShadow = true; this.group.add(m);
    if (lights.length) {
      const lg = new THREE.SphereGeometry(0.9, 6, 4), lm = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 3.2, 1.6), fog: true }); this.cityLights = new THREE.InstancedMesh(lg, lm, lights.length);
      lights.forEach(([x, y, z], i) => { o.position.set(x, y, z); o.scale.setScalar(1); o.updateMatrix(); this.cityLights.setMatrixAt(i, o.matrix); });
      this.group.add(this.cityLights);
    }
  }
  extra_tower() {
    const g = new THREE.Group(), x = -260, z = -820, y = this.h(x, z);
    const red = new THREE.MeshStandardMaterial({ color: '#d8441e', roughness: 0.5, emissive: '#ff6a1a', emissiveIntensity: 0 }), white = new THREE.MeshStandardMaterial({ color: '#eeeeea', roughness: 0.5, emissive: '#ffd0a0', emissiveIntensity: 0 });
    for (let i = 0; i < 9; i++) { const r0 = 46 * (1 - i / 10) ** 1.6 + 2, r1 = 46 * (1 - (i + 1) / 10) ** 1.6 + 2; const seg = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, 34, 4, 1, true), i % 2 ? white : red); seg.position.y = y + 17 + i * 34; seg.rotation.y = Math.PI / 4; g.add(seg); }
    const deck = new THREE.Mesh(new THREE.BoxGeometry(26, 10, 26), white); deck.position.y = y + 150; g.add(deck);
    g.position.set(x, 0, z); this.group.add(g); this.towerMats = [red, white];
  }
  extra_villas() {
    const R = rng(5), items = []; let t = 0;
    while (items.length < 70 && t++ < 4000) { const x = (R() - 0.5) * 1600, z = -150 - R() * 900; const y = this.h(x, z); if (y < 3 || y > 160 || this.slope(x, z) > 0.8 || Math.hypot(x, z) < 200) continue; items.push([x, y, z]); }
    const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0); const roof = new THREE.ConeGeometry(0.75, 0.45, 4); roof.rotateY(Math.PI / 4); roof.translate(0, 1.2, 0);
    const wm = this.windowMaterial(false); wm.color.set('#efe2c8'); const bm = new THREE.InstancedMesh(box, wm, items.length), rm = new THREE.InstancedMesh(roof, new THREE.MeshStandardMaterial({ color: '#b8583a', roughness: 0.8 }), items.length), o = new THREE.Object3D(), c = new THREE.Color();
    const tones = ['#f2e4c8', '#e8c9a0', '#f0d6b8', '#e6b88e', '#f5ecdc'];
    items.forEach(([x, y, z], i) => { o.position.set(x, y - 1, z); o.rotation.y = R() * 0.6; o.scale.set(12 + R() * 8, 9 + R() * 7, 10 + R() * 6); o.updateMatrix(); bm.setMatrixAt(i, o.matrix); bm.setColorAt(i, c.set(tones[i % 5])); rm.setMatrixAt(i, o.matrix); });
    bm.castShadow = rm.castShadow = false; this.group.add(bm, rm);
  }
  extra_waterfall() {
    const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uTime: this.uniforms.uTime }, vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: NOISE_GLSL + 'uniform float uTime; varying vec2 vUv; void main(){ float s=fbm2(vec2(vUv.x*14.,vUv.y*3.+uTime*2.2)); float a=smoothstep(0.35,0.75,s)*smoothstep(0.,0.2,vUv.x)*smoothstep(1.,0.8,vUv.x); gl_FragColor=vec4(vec3(0.95)*1.4,a*0.85);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n }' });
    for (const [x, w] of [[-260, 14], [420, 9]]) {
      const zr = this.L.t.z0 + this.L.t.a1 * Math.sin(x * 0.006 + 1) + this.L.t.a2 * Math.sin(x * 0.019); let z = zr - this.L.t.w - 30, top = this.h(x, z);
      while (top > 160 && z < zr) { z += 5; top = this.h(x, z); }
      const fall = new THREE.Mesh(new THREE.PlaneGeometry(w, top + 4), mat); fall.position.set(x, top / 2, z + 4); this.group.add(fall);
    }
  }

  update(dt, cam) {
    this.time += dt; this.uniforms.uTime.value = this.time; this.sky.material.uniforms.time.value = this.time;
    if (this.cityLights) this.cityLights.visible = this.night > 0.2;
    if (this.towerMats) this.towerMats.forEach(m => m.emissiveIntensity = this.night * 1.4);
  }
  aimShadow(target) { const t = target; this.sun.target.position.copy(t); this.sun.position.copy(t).addScaledVector(this.lightDir, 600); this.sun.target.updateMatrixWorld(); }
}
