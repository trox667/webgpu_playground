import {mat4, vec3} from 'gl-matrix'

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

export function buildViewProjectionMatrix(
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