export function checkForWebGPUSupport(): boolean {
  const gpu: GPU = window.navigator.gpu
  if (!!gpu) console.error('WebGPU is not supported on this browser.')
  return !!gpu
}

export async function loadShader(path: string): Promise<Uint32Array> {
  const response = await fetch(new Request(path), {
    method: 'GET',
    mode: 'cors',
  })
  const buf = await response.arrayBuffer()
  return new Uint32Array(buf)
}

export function createBuffer(
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