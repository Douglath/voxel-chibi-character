import * as T from 'three';
// Restrained emissive bloom. Geometry, materials and actual punctual lights remain exportable.
export class BlueHourFX {
 constructor(renderer){
  this.renderer=renderer;this.size=new T.Vector2();
  const options={type:T.HalfFloatType,depthBuffer:false};this.base=new T.WebGLRenderTarget(1,1,{...options,depthBuffer:true,samples:4});this.a=new T.WebGLRenderTarget(1,1,options);this.b=new T.WebGLRenderTarget(1,1,options);
  this.scene=new T.Scene();this.camera=new T.OrthographicCamera(-1,1,1,-1,0,1);
  const vertex='varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
  this.blur=new T.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{source:{value:null},stepSize:{value:new T.Vector2()},threshold:{value:1.}},vertexShader:vertex,fragmentShader:`varying vec2 vUv;uniform sampler2D source;uniform vec2 stepSize;uniform float threshold;vec3 bright(vec2 p){vec3 c=texture2D(source,p).rgb;float l=max(c.r,max(c.g,c.b));return c*max(l-threshold,0.)/max(l,.001);}void main(){vec3 c=bright(vUv)*.227027;c+=(bright(vUv+stepSize*1.384615)+bright(vUv-stepSize*1.384615))*.316216;c+=(bright(vUv+stepSize*3.230769)+bright(vUv-stepSize*3.230769))*.070270;gl_FragColor=vec4(c,1.);}`});
  this.compose=new T.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{base:{value:this.base.texture},bloom:{value:this.b.texture},strength:{value:.19},exposure:{value:1.28}},vertexShader:vertex,fragmentShader:`varying vec2 vUv;uniform sampler2D base,bloom;uniform float strength,exposure;vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}void main(){vec3 c=aces((texture2D(base,vUv).rgb+texture2D(bloom,vUv).rgb*strength)*exposure);gl_FragColor=vec4(mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(vec3(.0031308),c)),1.);}`});
  this.quad=new T.Mesh(new T.PlaneGeometry(2,2),this.blur);this.scene.add(this.quad);
 }
 render(scene,camera){
  const r=this.renderer;r.getDrawingBufferSize(this.size);const w=this.size.x,h=this.size.y;if(this.base.width!==w||this.base.height!==h){this.base.setSize(w,h);this.a.setSize(Math.max(1,w>>2),Math.max(1,h>>2));this.b.setSize(Math.max(1,w>>2),Math.max(1,h>>2));}
  const mapping=r.toneMapping;r.toneMapping=T.NoToneMapping;r.setRenderTarget(this.base);r.render(scene,camera);const drawCalls=r.info.render.calls;
  this.quad.material=this.blur;this.blur.uniforms.source.value=this.base.texture;this.blur.uniforms.threshold.value=1.15;this.blur.uniforms.stepSize.value.set(2.2/this.a.width,0);r.setRenderTarget(this.a);r.render(this.scene,this.camera);
  this.blur.uniforms.source.value=this.a.texture;this.blur.uniforms.threshold.value=0;this.blur.uniforms.stepSize.value.set(0,2.2/this.b.height);r.setRenderTarget(this.b);r.render(this.scene,this.camera);
  this.quad.material=this.compose;r.setRenderTarget(null);r.render(this.scene,this.camera);r.toneMapping=mapping;return drawCalls+3;
 }
}
