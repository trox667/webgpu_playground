# WebGPU Playground

Learning WebGPU by doing
Mainly by following along link #1 [links](#Links)

# Start

`npm i` to install dependencies
`npm run dev` will start parcel watching the source files and running a server on [http://localhost:1234](http://localhost:1234)

# Requirements

You probably need a bleeding edge version of chrome, edge or firefox
[webgpu status](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status)

To compile the shaders to SPIR-V see [glslang](https://github.com/KhronosGroup/glslang)
`glslangValidator -V src/triangle.vert -o dist/triangle.vert.spv`

# Links

1. https://alain.xyz/blog/raw-webgpu#entry-point
2. https://www.willusher.io/graphics/2020/06/20/0-to-gltf-bind-groups
3. https://sotrh.github.io/learn-wgpu/beginner/tutorial6-uniforms/#uniform-buffers-and-bind-groups