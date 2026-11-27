export default /* wgsl */ `
struct Uniforms {
  model : mat4x4f,
  view : mat4x4f,
  projection : mat4x4f,
  normalMatrix : mat4x4f,
  light1Pos : vec4f,
  light1Color : vec4f,
  light2Pos : vec4f,
  light2Color : vec4f,
  ambient : vec4f,
  diffuse : vec4f,
  specular : vec4f,
  materialParams : vec4f,
};

@group(0) @binding(0) var<uniform> uniforms : Uniforms;

fn computePointLight(
  lightWorldPos : vec4f,
  lightColor : vec4f,
  baseColor : vec3f,
  normal : vec3f,
  viewPosition : vec3f,
  cameraDir : vec3f,
) -> vec3f {
  let viewLightPos = uniforms.view * lightWorldPos;
  let lightDir = normalize(viewLightPos.xyz - viewPosition);

  let diffuseFactor = max(0.0, dot(lightDir, normal));
  let halfVector = normalize(lightDir + cameraDir);
  let specularFactor = pow(max(0.0, dot(halfVector, normal)), uniforms.materialParams.x);

  let diffuseTerm = diffuseFactor * uniforms.diffuse.a * lightColor.a * lightColor.rgb * baseColor;
  let specularTerm = select(
    vec3f(0.0),
    specularFactor * uniforms.specular.a * lightColor.a * lightColor.rgb * uniforms.specular.rgb,
    diffuseFactor > 0.0
  );

  return diffuseTerm + specularTerm;
}

@fragment
fn main(
  @location(0) color : vec4f,
  @location(1) viewPosition : vec3f,
  @location(2) viewNormal : vec3f,
) -> @location(0) vec4f {
  let normal = normalize(viewNormal);
  let cameraDir = normalize(-viewPosition);

  let ambientTerm = uniforms.ambient.a * uniforms.ambient.rgb * color.rgb;
  let light1 = computePointLight(uniforms.light1Pos, uniforms.light1Color, color.rgb, normal, viewPosition, cameraDir);
  let light2 = computePointLight(uniforms.light2Pos, uniforms.light2Color, color.rgb, normal, viewPosition, cameraDir);

  let litColor = ambientTerm + light1 + light2;
  return vec4f(litColor, 1.0);
}
`;