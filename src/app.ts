import { mat4, glMatrix, vec3 } from 'gl-matrix'
import { getModel } from './model'
import {
  buildProjectionMatrix,
  buildViewProjectionMatrix,
  OrbitCamera,
} from './camera'
import { createBuffer, loadShader } from './util'
import { createShader } from './shader'

let lastMousePos: vec3 = vec3.create()
let mousePos: vec3 = vec3.create()
let isLeftMousePressed = false

window.addEventListener('mousedown', (e) => {
  if (e.button === 0) {
    isLeftMousePressed = true
    lastMousePos = vec3.fromValues(e.clientX, e.clientY, 0.0)
    mousePos = vec3.fromValues(e.clientX, e.clientY, 0.0)
  }
})

window.addEventListener('mousemove', (e) => {
  if (isLeftMousePressed) {
    mousePos = vec3.fromValues(e.clientX, e.clientY, 0.0)
  }
})

window.addEventListener('mouseup', (e) => {
  if (e.button === 0) {
    isLeftMousePressed = false
    lastMousePos = vec3.fromValues(0.0, 0.0, 0.0)
    mousePos = vec3.fromValues(0.0, 0.0, 0.0)
  }
})

function createSwapChain(
  context: GPUCanvasContext,
  device: GPUDevice
): GPUSwapChain {
  const swapChainDesc: GPUSwapChainDescriptor = {
    device: device,
    format: 'bgra8unorm',
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
  }

  const swapchain: GPUSwapChain = context.configureSwapChain(swapChainDesc)

  return swapchain
}

async function createRenderPipeline(
  device: GPUDevice,
  layout: GPUPipelineLayout
): Promise<GPURenderPipeline> {
  // Pipeline
  const shaderData = await createShader(device)
  const pipelineDesc: GPURenderPipelineDescriptor = {
    layout,
    vertex: shaderData.vertex,
    fragment: shaderData.fragment,
    primitive: shaderData.primitive,
    depthStencil: shaderData.depthStencil,
  }

  let pipeline: GPURenderPipeline = device.createRenderPipeline(pipelineDesc)
  return pipeline
}

function createBindGroupLayout(device: GPUDevice): GPUBindGroupLayout {
  return device.createBindGroupLayout({
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
  })
}

function createBindGroup(
  device: GPUDevice,
  bindGroupLayout: GPUBindGroupLayout,
  buffer: GPUBuffer
): GPUBindGroup {
  return device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      {
        binding: 0,
        resource: {
          buffer: buffer,
        },
      },
    ],
  })
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
  passEncoder.setScissorRect(0, 0, width, height)
  passEncoder.setVertexBuffer(0, positionBuffer)
  passEncoder.setVertexBuffer(1, colorBuffer)
  passEncoder.setIndexBuffer(indexBuffer, 'uint16')
  passEncoder.drawIndexed(36, 1, 0, 0, 0)
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
  const swapchain = createSwapChain(context, device)

  const depthTextureDesc: GPUTextureDescriptor = {
    size: [canvas.width, canvas.height, 1],
    mipLevelCount: 1,
    sampleCount: 1,
    dimension: '2d',
    format: 'depth32float', // only this works in FF Nightly
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
  }

  const depthTexture: GPUTexture = device.createTexture(depthTextureDesc)
  const depthTextureView: GPUTextureView = depthTexture.createView()

  const colorTexture = swapchain.getCurrentTexture()
  const colorTextureView: GPUTextureView = colorTexture.createView()

  const model = getModel(device)
  const modelMat = mat4.create()
  mat4.fromTranslation(modelMat, [0.0, 0.0, 3.0])

  // shader data for matrix, primary color and accent color
  const uniformData = new Float32Array([
    1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0,
    1.0,

    1.0, 0.0, 0.0, 1.0,

    0.0, 0.0, 0.0, 1.0,
  ])
  let camera = new OrbitCamera()
  const viewProjMat = buildProjectionMatrix(camera.view(), modelMat)
  uniformData.set(viewProjMat)

  let uniformBuffer: GPUBuffer = createBuffer(
    device,
    uniformData,
    GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  )

  let uniformBindGroupLayout = createBindGroupLayout(device)

  let uniformBindGroup = createBindGroup(
    device,
    uniformBindGroupLayout,
    uniformBuffer
  )

  let layout: GPUPipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [uniformBindGroupLayout],
  })

  const pipeline = await createRenderPipeline(device, layout)

  let startTime = 0
  const scale = 0.7
  // command encoder
  const render = (time) => {
    if (startTime === 0) startTime = time
    const elapsed = time - startTime
    // tick
    if (elapsed > 100) {
      if (isLeftMousePressed) {
        const x = vec3.fromValues(
          mousePos[0] * scale / canvas.width - 0.5,
          mousePos[1] * scale / canvas.height - 0.5,
          0.0
        )
        const y = vec3.fromValues(
          lastMousePos[0] * scale / canvas.width - 0.5,
          lastMousePos[1] * scale / canvas.height - 0.5,
          0.0
        )
        camera.rotate(x, y)
        const viewProjMat = buildProjectionMatrix(camera.view(), modelMat)
        uniformData.set(viewProjMat)
        queue.writeBuffer(uniformBuffer, 0, uniformData)
      }
      startTime = 0
    }

    encodeCommands(
      device,
      queue,
      colorTextureView,
      depthTextureView,
      pipeline,
      canvas.width,
      canvas.height,
      [uniformBindGroup],
      model.positionBuffer,
      model.colorBuffer,
      model.indexBuffer
    )

    requestAnimationFrame(render)
  }

  requestAnimationFrame(render)

  // device.destroy()
}
