import { loadShader } from './util'

export interface ShaderData {
  vertex: GPUVertexState
  fragment: GPUFragmentState
  primitive: GPUPrimitiveState
  depthStencil: GPUDepthStencilState
}

export async function createShader(device: GPUDevice): Promise<ShaderData> {
  // load and compile shaders
  const vertexShaderModule = { code: await loadShader('./triangle.vert.spv') }
  const fragmentShaderModule = { code: await loadShader('./triangle.frag.spv') }

  let vertexModule: GPUShaderModule =
    device.createShaderModule(vertexShaderModule)
  let fragmentModule: GPUShaderModule =
    device.createShaderModule(fragmentShaderModule)

  const positionAttribDesc: GPUVertexAttribute = {
    shaderLocation: 0,
    offset: 0,
    format: 'float32x3',
  }

  const colorAttribDesc: GPUVertexAttribute = {
    shaderLocation: 1,
    offset: 0,
    format: 'float32x3',
  }

  const positionBufferDesc: GPUVertexBufferLayout = {
    attributes: [positionAttribDesc],
    arrayStride: 4 * 3, // 3 floats = 12byte
    stepMode: 'vertex',
  }

  const colorBufferDesc: GPUVertexBufferLayout = {
    attributes: [colorAttribDesc],
    arrayStride: 4 * 3,
    stepMode: 'vertex',
  }

  const depthStencil: GPUDepthStencilState = {
    depthWriteEnabled: true,
    depthCompare: 'less',
    format: 'depth32float',
  }

  const vertex: GPUVertexState = {
    module: vertexModule,
    entryPoint: 'main',
    buffers: [positionBufferDesc, colorBufferDesc],
  }

  const colorState: GPUColorTargetState = {
    format: 'bgra8unorm',
    blend: {
      alpha: {
        srcFactor: 'src-alpha',
        dstFactor: 'one-minus-src-alpha',
        operation: 'add',
      },
      color: {
        srcFactor: 'src-alpha',
        dstFactor: 'one-minus-src-alpha',
        operation: 'add',
      },
    },
    writeMask: GPUColorWrite.ALL,
  }

  const fragment: GPUFragmentState = {
    module: fragmentModule,
    entryPoint: 'main',
    targets: [colorState],
  }

  const primitive: GPUPrimitiveState = {
    frontFace: 'cw',
    cullMode: 'none',
    topology: 'triangle-list',
  }

  return {
    vertex,
    fragment,
    primitive,
    depthStencil,
  }
}
