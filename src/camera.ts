import { mat3, mat4, vec3, quat } from 'gl-matrix'

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
  model: mat4,
  eye: vec3 = vec3.fromValues(0.0, 0.0, 0.0),
  target: vec3 = vec3.fromValues(0.0, 0.0, 3.5),
  up: vec3 = vec3.fromValues(0.0, 1.0, 0.0),
  aspect: number = 1.5,
  fovy: number = 45.0,
  znear: number = 0.1,
  zfar: number = 1000
): mat4 {
  const view = mat4.create()
  const proj = mat4.create()

  mat4.lookAt(view, eye, target, up)
  return buildProjectionMatrix(view, model, aspect, fovy, znear, zfar)
}

export function buildProjectionMatrix(
  view: mat4,
  model: mat4,
  aspect: number = 1.5,
  fovy: number = 45.0,
  znear: number = 0.1,
  zfar: number = 1000
) {
  const proj = mat4.create()

  mat4.perspective(proj, fovy, aspect, znear, zfar)

  const viewProjMat = mat4.create()
  mat4.mul(viewProjMat, view, model)
  mat4.mul(viewProjMat, proj, viewProjMat)
  mat4.mul(viewProjMat, OPENGL_TO_WGPU_MATRIX, viewProjMat)
  return viewProjMat
}

// https://github.com/mikolalysenko/orbit-camera/blob/master/orbit.js
export class OrbitCamera {
  private rotation: quat
  private center: vec3
  private distance: number

  private scratch0: Float32Array
  private scratch1: Float32Array

  constructor(
    private eye: vec3 = vec3.fromValues(0, 0, 0.0),
    target: vec3 = vec3.fromValues(0.0, 0.0, 3.5),
    private up: vec3 = vec3.fromValues(0.0, 1.0, 0.0)
  ) {
    this.scratch0 = new Float32Array(16)
    this.scratch1 = new Float32Array(16)

    this.rotation = quat.create()
    this.center = target
    this.distance = 0.0
    this.lookAt()
  }

  private lookAt() {
    mat4.lookAt(this.scratch0, this.eye, this.center, this.up)
    mat3.fromMat4(this.scratch0, this.scratch0)
    quat.fromMat3(this.rotation, this.scratch0)
    this.distance = vec3.distance(this.eye, this.center)
  }

  private quatFromVec(out: Float32Array, delta: vec3) {
    const x = delta[0]
    const y = delta[1]
    const z = delta[2]
    let s = x * x + y * y
    if (s > 1.0) {
      s = 1.0
    }
    out[0] = -delta[0]
    out[1] = delta[1]
    out[2] = delta[2] || Math.sqrt(1.0 - s)
    out[3] = 0.0
  }

  rotate(deltaX: vec3, deltaY: vec3) {
    this.quatFromVec(this.scratch0, deltaX)
    this.quatFromVec(this.scratch1, deltaY)
    quat.invert(this.scratch1, this.scratch1)
    quat.multiply(this.scratch0, this.scratch0, this.scratch1)
    if (quat.length(this.scratch0) < 1e-6) return
    quat.multiply(this.rotation, this.rotation, this.scratch0)
    quat.normalize(this.rotation, this.rotation)
  }

  view(): mat4 {
    let out = mat4.create()
    this.scratch0[0] = this.scratch1[1] = 0.0
    this.scratch1[2] = -this.distance
    mat4.fromRotationTranslation(
      out,
      quat.conjugate(this.scratch0, this.rotation),
      this.scratch1
    )
    mat4.translate(out, out, vec3.negate(this.scratch0, this.center))
    return out
  }
}
