import { mat4, glMatrix, vec3 } from 'gl-matrix'

function checkForWebGPUSupport(): boolean {
  const gpu: GPU = window.navigator.gpu
  if (!!gpu) console.error('WebGPU is not supported on this browser.')
  return !!gpu
}

async function loadShader(path: string): Promise<Uint32Array> {
  const response = await fetch(new Request(path), {
    method: 'GET',
    mode: 'cors',
  })
  const buf = await response.arrayBuffer()
  return new Uint32Array(buf)
}

function createBuffer(
  device: GPUDevice,
  arr: Float32Array | Uint16Array,
  usage: number
): GPUBuffer {
  let desc: GPUBufferDescriptor = {
    size: (arr.byteLength + 3) & ~3,
    usage,
    mappedAtCreation: true,
  }
  let buffer = device.createBuffer(desc)
  const writeArray =
    arr instanceof Uint16Array
      ? new Uint16Array(buffer.getMappedRange())
      : new Float32Array(buffer.getMappedRange())
  writeArray.set(arr)
  buffer.unmap()
  return buffer
}

function encodeCommands(
  device: GPUDevice,
  queue: GPUQueue,
  colorTextureView: GPUTextureView,
  depthTextureView: GPUTextureView,
  pipeline: GPURenderPipeline,
  width: number,
  height: number,
  bindGroups: GPUBindGroup[],
  positionBuffer: GPUBuffer,
  colorBuffer: GPUBuffer,
  indexBuffer: GPUBuffer
) {
  const colorAttachment: GPURenderPassColorAttachment = {
    view: colorTextureView,
    loadValue: { r: 0, g: 0, b: 0, a: 1 },
    storeOp: 'store',
  }

  const depthAttachment: GPURenderPassDepthStencilAttachment = {
    view: depthTextureView,
    depthLoadValue: 1,
    depthStoreOp: 'store',
    stencilLoadValue: 'load',
    stencilStoreOp: 'store',
  }

  const renderPassDesc: GPURenderPassDescriptor = {
    colorAttachments: [colorAttachment],
    depthStencilAttachment: depthAttachment,
  }

  const commandEncoder: GPUCommandEncoder = device.createCommandEncoder()

  const passEncoder: GPURenderPassEncoder =
    commandEncoder.beginRenderPass(renderPassDesc)
  passEncoder.setPipeline(pipeline)
  passEncoder.setBindGroup(0, bindGroups[0])
  passEncoder.setViewport(0, 0, width, height, 0, 1)
  passEncoder.setScissorRect(0, 0, width/2, height)
  passEncoder.setVertexBuffer(0, positionBuffer)
  passEncoder.setVertexBuffer(1, colorBuffer)
  passEncoder.setIndexBuffer(indexBuffer, 'uint16')
  passEncoder.drawIndexed(36, 1, 0, 0, 0)
  passEncoder.setBindGroup(0, bindGroups[1])
  passEncoder.setViewport(0, 0, width, height, 0, 1)
  passEncoder.setScissorRect(width/2, 0, width/2, height)
  passEncoder.setVertexBuffer(0, positionBuffer)
  passEncoder.setVertexBuffer(1, colorBuffer)
  passEncoder.setIndexBuffer(indexBuffer, 'uint16')
  passEncoder.drawIndexed(36, 1, 0, 0, 0)
  passEncoder.endPass()

  queue.submit([commandEncoder.finish()])
}

const OPENGL_TO_WGPU_MATRIX: mat4 = mat4.fromValues(
  1.0,
  0.0,
  0.0,
  0.0,
  0.0,
  1.0,
  0.0,
  0.0,
  0.0,
  0.0,
  0.5,
  0.0,
  0.0,
  0.0,
  0.5,
  1.0
)

function buildViewProjectionMatrix(
  eye: vec3 = vec3.fromValues(0.0, 1.0, 3.0),
  target: vec3 = vec3.fromValues(0.0, 0.0, 0.0),
  up: vec3 = vec3.fromValues(0.0, 1.0, 0.0),
  aspect: number = 1.5,
  fovy: number = 45.0,
  znear: number = 0.1,
  zfar: number = 1000
): mat4 {
  const view = mat4.create()
  const proj = mat4.create()

  mat4.lookAt(view, eye, target, up)
  mat4.perspective(proj, fovy, aspect, znear, zfar)

  const viewProjMat = mat4.create()
  mat4.mul(viewProjMat, OPENGL_TO_WGPU_MATRIX, viewProjMat)
  mat4.mul(viewProjMat, proj, view)
  return viewProjMat
}

export async function init() {
  const adapter = await window.navigator.gpu.requestAdapter()
  console.log(adapter)

  const device = await adapter.requestDevice()
  console.log(device)

  let queue: GPUQueue = device.queue

  let canvas = document.getElementById('canvas') as HTMLCanvasElement
  if (!canvas) throw new Error('Could not get #canvas element')

  const context: GPUCanvasContext = canvas.getContext('gpupresent')

  const swapChainDesc: GPUSwapChainDescriptor = {
    device: device,
    format: 'bgra8unorm',
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
  }

  let swapchain: GPUSwapChain = context.configureSwapChain(swapChainDesc)

  const depthTextureDesc: GPUTextureDescriptor = {
    size: [canvas.width, canvas.height, 1],
    mipLevelCount: 1,
    sampleCount: 1,
    dimension: '2d',
    format: 'depth32float', // only this works in FF Nightly
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
  }

  let depthTexture: GPUTexture = device.createTexture(depthTextureDesc)
  let depthTextureView: GPUTextureView = depthTexture.createView()

  let colorTexture = swapchain.getCurrentTexture()
  let colorTextureView: GPUTextureView = colorTexture.createView()

  // create triangle buffer data
  const positions = new Float32Array([
    // front
    -0.5, -0.5, 0.0, 0.5, -0.5, 0.0, 0.5, 0.5, 0.0, -0.5, 0.5, 0.0,

    // rear
    -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5,

    // top
    -0.5, 0.5, 0.5, -0.5, 0.5, 0.0, 0.5, 0.5, 0.0, 0.5, 0.5, 0.5,

    // bottom
    -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.0, -0.5, -0.5, 0.0,

    // right
    0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.0, 0.5, -0.5, 0.0,

    // left
    -0.5, -0.5, 0.5, -0.5, -0.5, 0.0, -0.5, 0.5, 0.0, -0.5, 0.5, 0.5,
  ])

  const colors = new Float32Array([
    0.5, 0.0, 0.0, 0.5, 0.0, 0.0, 0.5, 0.0, 0.0, 0.5, 0.0, 0.0,

    0.0, 0.5, 0.0, 0.0, 0.5, 0.0, 0.0, 0.5, 0.0, 0.0, 0.5, 0.0,

    0.0, 0.0, 0.5, 0.0, 0.0, 0.5, 0.0, 0.0, 0.5, 0.0, 0.0, 0.5,

    0.5, 0.5, 0.0, 0.5, 0.5, 0.0, 0.5, 0.5, 0.0, 0.5, 0.5, 0.0,

    0.0, 0.5, 0.5, 0.0, 0.5, 0.5, 0.0, 0.5, 0.5, 0.0, 0.5, 0.5,

    0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5,
  ])

  const indices = new Uint16Array([
    0,
    1,
    2,
    0,
    2,
    3, // front
    4,
    5,
    6,
    4,
    6,
    7, // rear
    8,
    9,
    10,
    8,
    10,
    11, // top
    12,
    13,
    14,
    12,
    14,
    15, // bottom
    16,
    17,
    18,
    16,
    18,
    19, // right
    20,
    21,
    22,
    20,
    22,
    23, // left
  ])

  const positionBuffer: GPUBuffer = createBuffer(
    device,
    positions,
    GPUBufferUsage.VERTEX
  )
  const colorBuffer: GPUBuffer = createBuffer(
    device,
    colors,
    GPUBufferUsage.VERTEX
  )
  const indexBuffer: GPUBuffer = createBuffer(
    device,
    indices,
    GPUBufferUsage.INDEX
  )

  // load and compile shaders
  const vertexShaderModule = { code: await loadShader('./triangle.vert.spv') }
  const fragmentShaderModule = { code: await loadShader('./triangle.frag.spv') }

  let vertexModule: GPUShaderModule =
    device.createShaderModule(vertexShaderModule)
  let fragmentModule: GPUShaderModule =
    device.createShaderModule(fragmentShaderModule)

  // shader data for matrix, primary color and accent color
  const uniformData = new Float32Array([
    1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0,
    1.0,

    1.0, 0.0, 0.0, 1.0,

    0.0, 0.0, 0.0, 1.0,
  ])
  const viewProjMat = buildViewProjectionMatrix()
  uniformData.set(viewProjMat)

  let uniformBuffer: GPUBuffer = createBuffer(
    device,
    uniformData,
    GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  )

    // shader data for matrix, primary color and accent color
  const uniformData2 = new Float32Array([
    1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0,
    1.0,

    0.0, 1.0, 0.0, 1.0,

    0.0, 0.0, 0.0, 1.0,
  ])
  uniformData2.set(viewProjMat)

  let uniformBuffer2: GPUBuffer = createBuffer(
    device,
    uniformData2,
    GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  )

  let uniformBindGroupLayout: GPUBindGroupLayout = device.createBindGroupLayout(
    {
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: {
            type: 'uniform',
            hasDynamicOffset: false,
            minBindingSize: 0,
          },
        },
      ],
    }
  )

  let uniformBindGroup: GPUBindGroup = device.createBindGroup({
    layout: uniformBindGroupLayout,
    entries: [
      {
        binding: 0,
        resource: {
          buffer: uniformBuffer,
        },
      },
    ],
  })  

  let uniformBindGroup2: GPUBindGroup = device.createBindGroup({
    layout: uniformBindGroupLayout,
    entries: [
      {
        binding: 0,
        resource: {
          buffer: uniformBuffer2,
        },
      },
    ],
  })

  let layout: GPUPipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [uniformBindGroupLayout],
  })

  // Pipeline

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

  const pipelineDesc: GPURenderPipelineDescriptor = {
    layout,
    vertex,
    fragment,
    primitive,
    depthStencil,
  }

  let pipeline: GPURenderPipeline = device.createRenderPipeline(pipelineDesc)

  let start = 0
  let z = 3
  // command encoder
  const render = (time) => {
    if (start === 0) start = time
    const elapsed = time - start
    if (elapsed > 100) {
      z+=0.1
      const viewProjMat = buildViewProjectionMatrix(vec3.fromValues(0, 1, z))
      uniformData.set(viewProjMat)
      queue.writeBuffer(uniformBuffer, 0, uniformData)
      start = 0;
    }

    encodeCommands(
      device,
      queue,
      colorTextureView,
      depthTextureView,
      pipeline,
      canvas.width,
      canvas.height,
      [uniformBindGroup, uniformBindGroup2],
      positionBuffer,
      colorBuffer,
      indexBuffer
    )

    requestAnimationFrame(render)
  }

  requestAnimationFrame(render)

  // device.destroy()
}
