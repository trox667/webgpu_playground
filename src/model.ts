import { createBuffer } from './util'

// create triangle buffer data
const POSITIONS = new Float32Array([
  // front
  -0.5, -0.5, 0.0,
   0.5, -0.5, 0.0,
   0.5, 0.5, 0.0,
  -0.5, 0.5, 0.0,

  // rear
  -0.5, -0.5, 0.5,
  -0.5, 0.5, 0.5,
   0.5, 0.5, 0.5,
   0.5, -0.5, 0.5,

  // top
  -0.5, 0.5, 0.5, -0.5, 0.5, 0.0, 0.5, 0.5, 0.0, 0.5, 0.5, 0.5,

  // bottom
  -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.0, -0.5, -0.5, 0.0,

  // right
  0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.0, 0.5, -0.5, 0.0,

  // left
  -0.5, -0.5, 0.5, -0.5, -0.5, 0.0, -0.5, 0.5, 0.0, -0.5, 0.5, 0.5,
])

const COLORS = new Float32Array([
  0.5, 0.0, 0.0, 0.5, 0.0, 0.0, 0.5, 0.0, 0.0, 0.5, 0.0, 0.0,

  0.0, 0.5, 0.0, 0.0, 0.5, 0.0, 0.0, 0.5, 0.0, 0.0, 0.5, 0.0,

  0.0, 0.0, 0.5, 0.0, 0.0, 0.5, 0.0, 0.0, 0.5, 0.0, 0.0, 0.5,

  0.5, 0.5, 0.0, 0.5, 0.5, 0.0, 0.5, 0.5, 0.0, 0.5, 0.5, 0.0,

  0.0, 0.5, 0.5, 0.0, 0.5, 0.5, 0.0, 0.5, 0.5, 0.0, 0.5, 0.5,

  0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5,
])

const INDICES = new Uint16Array([
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

export interface Model {
  positionBuffer: GPUBuffer
  colorBuffer: GPUBuffer
  indexBuffer: GPUBuffer
}

export function getModel(device: GPUDevice): Model {
  return {
    positionBuffer: createBuffer(device, POSITIONS, GPUBufferUsage.VERTEX),
    colorBuffer: createBuffer(device, COLORS, GPUBufferUsage.VERTEX),
    indexBuffer: createBuffer(device, INDICES, GPUBufferUsage.INDEX),
  }
}
