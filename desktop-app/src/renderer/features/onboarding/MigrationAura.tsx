import { useEffect, useRef } from "react";

const fullscreenVertexShader = `#version 300 es
precision highp float;
out vec2 uv;
void main() {
  vec2 vertices[3] = vec2[3](vec2(-1., -1.), vec2(3., -1.), vec2(-1., 3.));
  vec2 point = vertices[gl_VertexID];
  uv = point * .5 + .5;
  gl_Position = vec4(point, 0., 1.);
}`;

const backdropFragmentShader = `#version 300 es
precision highp float;
in vec2 uv;
out vec4 color;

float noise(vec2 point) {
  return fract(52.9829189 * fract(dot(point, vec2(.06711056, .00583715))));
}

void main() {
  vec2 direction = vec2(1., 0.);
  float position = clamp(dot(uv - .5, direction) + .5, 0., 1.);
  vec3 upper = mix(vec3(.278431, .321569, .396078), vec3(.368627, .333333, .490196), smoothstep(0., .65, position));
  vec3 shaded = mix(vec3(.188235, .188235, .2), upper, smoothstep(.2, 1., uv.y));
  shaded = mix(shaded, vec3(.176471), 1. - smoothstep(0., .2, uv.y));
  shaded += (noise(gl_FragCoord.xy) - .5) / 255.;
  color = vec4(clamp(shaded, 0., 1.), 1.);
}`;

const raysFragmentShader = `#version 300 es
precision highp float;
in vec2 uv;
out vec4 color;

const float PI = 3.14159265359;
const float MAX_RADIUS = .70710678;

float hash(float index, float seed) {
  return fract(sin(index * seed) * 43758.5453123);
}

vec4 rays(vec2 point) {
  vec4 total = vec4(0.);
  vec2 centered = point - vec2(.5);
  float angle = atan(centered.y, centered.x);
  float positiveAngle = angle < 0. ? angle + 2. * PI : angle;
  float radius = length(centered) / MAX_RADIUS;

  for (int ray = 0; ray < 8; ray += 1) {
    float index = float(ray);
    float centerAngle = (2. * PI / 8.) * (index + .5);
    float delta = positiveAngle - centerAngle;
    float angularDistance = abs(atan(sin(delta), cos(delta)));
    float halfAngle = clamp(.03 + hash(index, 2.17) * .05, .02, .10);
    if (angularDistance > halfAngle) continue;

    float radialCenter = .05 + fract(.25 + hash(index, 4.11) * .5) * .9;
    float presence = smoothstep(0., .12, radialCenter) * smoothstep(0., .12, 1. - radialCenter);
    float halfLength = max((.12 + hash(index, 6.33) * .08) * 3.28 * presence, .0001);
    float radialDistance = abs(radius - radialCenter);
    if (radialDistance > halfLength) continue;

    float strength = pow(1. - angularDistance / halfAngle, 2.2) * pow(1. - radialDistance / halfLength, 2.2) * presence;
    int baseIndex = (ray / 4) % 6;
    int nextIndex = (baseIndex + 1) % 6;
    vec3 palette[6] = vec3[6](
      vec3(.337255, .423529, .572549),
      vec3(.407843, .470588, .670588),
      vec3(.517647, .564706, .749020),
      vec3(.643137, .678431, .827451),
      vec3(.780392, .803922, .917647),
      vec3(.443137, .411765, .607843)
    );
    vec3 tint = mix(palette[baseIndex], palette[nextIndex], radius);
    float delay = hash(index, 13.31);
    float visibility = smoothstep(delay, delay + .3, 1.);
    total.rgb += tint * strength * visibility;
    total.a = clamp(total.a + strength * visibility, 0., 1.);
  }
  return total;
}

void main() {
  vec2 point = vec2(uv.x, 1. - uv.y);
  vec2 pixel = point * vec2(960., 500.);
  vec2 offset = pixel - vec2(480., 250.);
  vec2 direction = length(offset) > 0. ? normalize(offset) : vec2(0.);
  vec2 shift = direction * 25. / vec2(960., 500.);
  vec4 red = rays(clamp(point + shift, 0., 1.));
  vec4 green = rays(point);
  vec4 blue = rays(clamp(point - shift, 0., 1.));
  float alpha = max(red.a, max(green.a, blue.a));
  vec3 mixed = vec3(red.r, green.g, blue.b);
  mixed = (1. - (1. - mixed) * (1. - mixed * alpha)) * 2.8;
  color = alpha < .008 ? vec4(0.) : vec4(mixed, alpha);
}`;

const blurFragmentShader = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 uv;
out vec4 color;
uniform sampler2D image;
uniform vec2 stepSize;
uniform vec2 axis;
uniform float sigma;

void main() {
  vec4 sum = vec4(0.);
  float weights = 0.;
  for (int index = -12; index <= 12; index += 1) {
    float distance = float(index);
    float normalized = distance / max(sigma, .001);
    float weight = exp(-.5 * normalized * normalized);
    sum += texture(image, clamp(uv + axis * stepSize * distance, 0., 1.)) * weight;
    weights += weight;
  }
  color = sum / max(weights, .0001);
}`;

const copyFragmentShader = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 uv;
out vec4 color;
uniform sampler2D image;
uniform float fadeEnd;
void main() {
  float fade = fadeEnd > 0. ? smoothstep(0., fadeEnd, uv.y) : 1.;
  color = texture(image, uv) * fade;
}`;

type RenderTarget = {
  framebuffer: WebGLFramebuffer;
  texture: WebGLTexture;
};

function compileProgram(
  gl: WebGL2RenderingContext,
  fragmentSource: string,
): WebGLProgram {
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) throw new Error("Unable to create migration shader");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(message ?? "Unable to compile migration shader");
    }
    return shader;
  };

  const vertex = compile(gl.VERTEX_SHADER, fullscreenVertexShader);
  const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) throw new Error("Unable to create migration program");
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(message ?? "Unable to link migration program");
  }
  return program;
}

function uniform(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  name: string,
): WebGLUniformLocation {
  const location = gl.getUniformLocation(program, name);
  if (!location) throw new Error(`Missing migration uniform: ${name}`);
  return location;
}

function createTarget(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  highDynamicRange: boolean,
): RenderTarget {
  const texture = gl.createTexture();
  const framebuffer = gl.createFramebuffer();
  if (!texture || !framebuffer)
    throw new Error("Unable to create migration target");
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    highDynamicRange ? gl.RGBA16F : gl.RGBA8,
    width,
    height,
    0,
    gl.RGBA,
    highDynamicRange ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE,
    null,
  );
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    texture,
    0,
  );
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error("Incomplete migration target");
  }
  return { framebuffer, texture };
}

function initializeAura(canvas: HTMLCanvasElement): () => void {
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: true,
    depth: false,
    powerPreference: "high-performance",
    preserveDrawingBuffer: false,
    stencil: false,
  });
  if (!gl) return () => undefined;

  const backdropProgram = compileProgram(gl, backdropFragmentShader);
  const raysProgram = compileProgram(gl, raysFragmentShader);
  const blurProgram = compileProgram(gl, blurFragmentShader);
  const copyProgram = compileProgram(gl, copyFragmentShader);
  const vertexArray = gl.createVertexArray();
  if (!vertexArray) throw new Error("Unable to create migration vertex array");
  gl.bindVertexArray(vertexArray);

  const highDynamicRange = Boolean(
    gl.getExtension("EXT_color_buffer_float") &&
      gl.getExtension("OES_texture_float_linear"),
  );
  const rayTarget = createTarget(gl, 653, 340, highDynamicRange);
  const firstTarget = createTarget(gl, 164, 85, highDynamicRange);
  const secondTarget = createTarget(gl, 164, 85, highDynamicRange);

  const copyImage = uniform(gl, copyProgram, "image");
  const copyFade = uniform(gl, copyProgram, "fadeEnd");
  const blurImage = uniform(gl, blurProgram, "image");
  const blurStep = uniform(gl, blurProgram, "stepSize");
  const blurAxis = uniform(gl, blurProgram, "axis");
  const blurSigma = uniform(gl, blurProgram, "sigma");

  const render = () => {
    const bounds = canvas.getBoundingClientRect();
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(bounds.width * scale));
    canvas.height = Math.max(1, Math.round(bounds.height * scale));

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, rayTarget.framebuffer);
    gl.viewport(0, 0, 653, 340);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(raysProgram);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.bindFramebuffer(gl.FRAMEBUFFER, firstTarget.framebuffer);
    gl.viewport(0, 0, 164, 85);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(copyProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(copyImage, 0);
    gl.uniform1f(copyFade, 0);
    gl.bindTexture(gl.TEXTURE_2D, rayTarget.texture);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.useProgram(blurProgram);
    gl.uniform1i(blurImage, 0);
    gl.uniform2f(blurStep, 1 / 164, 1 / 85);
    gl.uniform1f(blurSigma, 1.6688);
    for (let pass = 0; pass < 6; pass += 1) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, secondTarget.framebuffer);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindTexture(gl.TEXTURE_2D, firstTarget.texture);
      gl.uniform2f(blurAxis, 1, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, firstTarget.framebuffer);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindTexture(gl.TEXTURE_2D, secondTarget.texture);
      gl.uniform2f(blurAxis, 0, 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(backdropProgram);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(copyProgram);
    gl.uniform1i(copyImage, 0);
    gl.uniform1f(copyFade, 0.9);
    gl.bindTexture(gl.TEXTURE_2D, firstTarget.texture);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.BLEND);
  };

  const resizeObserver = new ResizeObserver(render);
  resizeObserver.observe(canvas);
  render();
  return () => {
    resizeObserver.disconnect();
    for (const target of [rayTarget, firstTarget, secondTarget]) {
      gl.deleteTexture(target.texture);
      gl.deleteFramebuffer(target.framebuffer);
    }
    gl.deleteVertexArray(vertexArray);
    gl.deleteProgram(backdropProgram);
    gl.deleteProgram(raysProgram);
    gl.deleteProgram(blurProgram);
    gl.deleteProgram(copyProgram);
  };
}

export function MigrationAura() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      return initializeAura(canvas);
    } catch {
      return;
    }
  }, []);

  return (
    <canvas
      aria-hidden="true"
      className="migration-modal__aura"
      ref={canvasRef}
    />
  );
}
