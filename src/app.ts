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
  bindGroup: GPUBindGroup,
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
  passEncoder.setBindGroup(0, bindGroup)
  passEncoder.setViewport(0, 0, width, height, 0, 1)
  passEncoder.setScissorRect(0, 0, width, height)
  passEncoder.setVertexBuffer(0, positionBuffer)
  passEncoder.setVertexBuffer(1, colorBuffer)
  passEncoder.setIndexBuffer(indexBuffer, 'uint16')
  passEncoder.drawIndexed(6, 1, 0, 0, 0)
  passEncoder.endPass()

  queue.submit([commandEncoder.finish()])
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
    -0.5, -0.5, 0.0, 
    0.5, 0.5, 0.0,
    0.5, -0.5, 0.0,
    -0.5, 0.5, 0.0,
  ])

  const colors = new Float32Array([
    0.5, 0.0, 0.0, 
    0.0, 0.5, 0.0, 
    0.0, 0.0, 0.5,
    0.5, 0.5, 0.0,
  ])

  const indices = new Uint16Array([0, 1, 2, 0, 3, 1, 0])

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
    1.0, 0.0, 0.0, 0.0, 
    0.0, 1.0, 0.0, 0.0, 
    0.0, 0.0, 1.0, 0.0, 
    0.0, 0.0, 0.0, 1.0,

    0.1, 0.9, 0.3, 1.0,

    0.8, 0.2, 0.8, 1.0,
  ])

  let uniformBuffer: GPUBuffer = createBuffer(
    device,
    uniformData,
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
          }
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

  // command encoder
  const render = () => {
    encodeCommands(
      device,
      queue,
      colorTextureView,
      depthTextureView,
      pipeline,
      canvas.width,
      canvas.height,
      uniformBindGroup,
      positionBuffer,
      colorBuffer,
      indexBuffer
    )

    requestAnimationFrame(render)
  }

  render()


  // device.destroy()
}
