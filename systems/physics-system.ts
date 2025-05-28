import * as THREE from 'three'

export interface RigidBody {
  id: string
  position: THREE.Vector3
  velocity: THREE.Vector3
  angularVelocity: THREE.Vector3
  mass: number
  friction: number
  restitution: number
  isKinematic: boolean
  shape: 'box' | 'sphere' | 'capsule'
  size: THREE.Vector3
  mesh?: THREE.Object3D
}

export interface RagdollJoint {
  bodyA: string
  bodyB: string
  anchor: THREE.Vector3
  limits?: { min: number; max: number }
}

export interface RagdollDefinition {
  bodies: RigidBody[]
  joints: RagdollJoint[]
}

export class PhysicsSystem {
  private bodies: Map<string, RigidBody> = new Map()
  private gravity: THREE.Vector3 = new THREE.Vector3(0, -9.81, 0)
  private timeStep: number = 1 / 60
  private damping: number = 0.99
  private angularDamping: number = 0.95

  constructor() {
    // Initialize physics world
  }

  public addRigidBody(body: RigidBody): void {
    this.bodies.set(body.id, body)
  }

  public removeRigidBody(id: string): void {
    this.bodies.delete(id)
  }

  public getRigidBody(id: string): RigidBody | undefined {
    return this.bodies.get(id)
  }

  public createRagdoll(position: THREE.Vector3, impulse?: THREE.Vector3): string {
    const ragdollId = `ragdoll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Create simplified ragdoll with main body parts
    const bodies: RigidBody[] = [
      // Torso
      {
        id: `${ragdollId}_torso`,
        position: position.clone(),
        velocity: new THREE.Vector3(),
        angularVelocity: new THREE.Vector3(),
        mass: 10,
        friction: 0.5,
        restitution: 0.1,
        isKinematic: false,
        shape: 'box',
        size: new THREE.Vector3(0.6, 1.2, 0.3)
      },
      // Head
      {
        id: `${ragdollId}_head`,
        position: position.clone().add(new THREE.Vector3(0, 1.5, 0)),
        velocity: new THREE.Vector3(),
        angularVelocity: new THREE.Vector3(),
        mass: 2,
        friction: 0.5,
        restitution: 0.1,
        isKinematic: false,
        shape: 'sphere',
        size: new THREE.Vector3(0.3, 0.3, 0.3)
      },
      // Left Arm
      {
        id: `${ragdollId}_leftarm`,
        position: position.clone().add(new THREE.Vector3(-0.8, 0.5, 0)),
        velocity: new THREE.Vector3(),
        angularVelocity: new THREE.Vector3(),
        mass: 3,
        friction: 0.5,
        restitution: 0.1,
        isKinematic: false,
        shape: 'box',
        size: new THREE.Vector3(0.2, 0.8, 0.2)
      },
      // Right Arm
      {
        id: `${ragdollId}_rightarm`,
        position: position.clone().add(new THREE.Vector3(0.8, 0.5, 0)),
        velocity: new THREE.Vector3(),
        angularVelocity: new THREE.Vector3(),
        mass: 3,
        friction: 0.5,
        restitution: 0.1,
        isKinematic: false,
        shape: 'box',
        size: new THREE.Vector3(0.2, 0.8, 0.2)
      },
      // Left Leg
      {
        id: `${ragdollId}_leftleg`,
        position: position.clone().add(new THREE.Vector3(-0.3, -1.0, 0)),
        velocity: new THREE.Vector3(),
        angularVelocity: new THREE.Vector3(),
        mass: 4,
        friction: 0.5,
        restitution: 0.1,
        isKinematic: false,
        shape: 'box',
        size: new THREE.Vector3(0.2, 1.0, 0.2)
      },
      // Right Leg
      {
        id: `${ragdollId}_rightleg`,
        position: position.clone().add(new THREE.Vector3(0.3, -1.0, 0)),
        velocity: new THREE.Vector3(),
        angularVelocity: new THREE.Vector3(),
        mass: 4,
        friction: 0.5,
        restitution: 0.1,
        isKinematic: false,
        shape: 'box',
        size: new THREE.Vector3(0.2, 1.0, 0.2)
      }
    ]

    // Add all bodies to physics world
    bodies.forEach(body => this.addRigidBody(body))

    // Apply initial impulse if provided
    if (impulse) {
      bodies.forEach(body => {
        body.velocity.add(impulse.clone().multiplyScalar(0.5 + Math.random() * 0.5))
        body.angularVelocity.add(new THREE.Vector3(
          (Math.random() - 0.5) * 5,
          (Math.random() - 0.5) * 5,
          (Math.random() - 0.5) * 5
        ))
      })
    }

    return ragdollId
  }

  public step(deltaTime: number): void {
    const dt = Math.min(deltaTime, this.timeStep)

    for (const [id, body] of this.bodies) {
      if (body.isKinematic) continue

      // Apply gravity
      body.velocity.add(this.gravity.clone().multiplyScalar(dt))

      // Apply damping
      body.velocity.multiplyScalar(this.damping)
      body.angularVelocity.multiplyScalar(this.angularDamping)

      // Update position
      body.position.add(body.velocity.clone().multiplyScalar(dt))

      // Simple ground collision
      if (body.position.y < body.size.y / 2) {
        body.position.y = body.size.y / 2
        body.velocity.y = Math.abs(body.velocity.y) * body.restitution
        body.velocity.x *= body.friction
        body.velocity.z *= body.friction
      }

      // Update mesh if attached
      if (body.mesh) {
        body.mesh.position.copy(body.position)
        
        // Apply angular velocity to rotation (simplified)
        if (body.angularVelocity.length() > 0.01) {
          const axis = body.angularVelocity.clone().normalize()
          const angle = body.angularVelocity.length() * dt
          const quaternion = new THREE.Quaternion().setFromAxisAngle(axis, angle)
          body.mesh.quaternion.multiplyQuaternions(quaternion, body.mesh.quaternion)
        }
      }
    }
  }

  public cleanupRagdoll(ragdollId: string): void {
    const bodiesToRemove = Array.from(this.bodies.keys()).filter(id => id.startsWith(ragdollId))
    bodiesToRemove.forEach(id => this.removeRigidBody(id))
  }

  public applyImpulse(bodyId: string, impulse: THREE.Vector3, point?: THREE.Vector3): void {
    const body = this.bodies.get(bodyId)
    if (!body) return

    body.velocity.add(impulse.clone().divideScalar(body.mass))
    
    if (point) {
      const torque = point.clone().sub(body.position).cross(impulse)
      body.angularVelocity.add(torque.divideScalar(body.mass))
    }
  }

  public getRagdollBodies(ragdollId: string): RigidBody[] {
    return Array.from(this.bodies.values()).filter(body => body.id.startsWith(ragdollId))
  }
} 