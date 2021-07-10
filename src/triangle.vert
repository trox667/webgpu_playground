#version 450

layout (set = 0, binding = 0) uniform ViewParams
{
  mat4 modelViewProj;
  vec4 primaryColor;
  vec4 accentColor;
};

layout (location = 0) in vec3 inPos;
layout (location = 1) in vec3 inColor;

layout (location = 0) out vec3 outColor;

void main()
{
    //outColor = inColor;
    outColor = vec3(primaryColor.r, primaryColor.g, primaryColor.b);
    gl_Position = modelViewProj * vec4(inPos, 1.0);
}