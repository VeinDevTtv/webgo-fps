"use client"

import { useRef, useMemo, useEffect } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"
import { WeatherType, WeatherEffects } from "@/systems/weather-system"

interface WeatherParticlesProps {
  weatherType: WeatherType
  effects: WeatherEffects
  playerPosition: THREE.Vector3
}

export default function WeatherParticles({ weatherType, effects, playerPosition }: WeatherParticlesProps) {
  const particlesRef = useRef<THREE.Points>(null)
  const particleCount = effects.particleCount
  const windStrength = effects.windStrength

  // Create particle geometry and material
  const { geometry, material } = useMemo(() => {
    if (particleCount === 0) {
      return { geometry: null, material: null }
    }

    const geo = new THREE.BufferGeometry()
    const positions = new Float32Array(particleCount * 3)
    const velocities = new Float32Array(particleCount * 3)
    const sizes = new Float32Array(particleCount)

    // Initialize particles around player
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3

      // Position particles in a box around the player
      positions[i3] = (Math.random() - 0.5) * 200 // x
      positions[i3 + 1] = Math.random() * 100 + 20 // y (above ground)
      positions[i3 + 2] = (Math.random() - 0.5) * 200 // z

      // Set initial velocities based on weather type
      if (weatherType === WeatherType.RAIN || weatherType === WeatherType.THUNDERSTORM) {
        // Rain falls down with some wind
        velocities[i3] = (Math.random() - 0.5) * windStrength * 2 // x wind
        velocities[i3 + 1] = -10 - Math.random() * 5 // y fall speed
        velocities[i3 + 2] = (Math.random() - 0.5) * windStrength * 2 // z wind
        sizes[i] = 0.1 + Math.random() * 0.1
      } else {
        // Default particle behavior
        velocities[i3] = (Math.random() - 0.5) * windStrength
        velocities[i3 + 1] = -2 - Math.random() * 2
        velocities[i3 + 2] = (Math.random() - 0.5) * windStrength
        sizes[i] = 0.05 + Math.random() * 0.05
      }
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3))
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1))

    // Create material based on weather type
    let mat: THREE.PointsMaterial
    
    if (weatherType === WeatherType.RAIN || weatherType === WeatherType.THUNDERSTORM) {
      mat = new THREE.PointsMaterial({
        color: 0x4A90E2,
        size: 0.1,
        transparent: true,
        opacity: 0.6,
        vertexColors: false,
        sizeAttenuation: true
      })
    } else {
      mat = new THREE.PointsMaterial({
        color: 0xFFFFFF,
        size: 0.05,
        transparent: true,
        opacity: 0.4,
        vertexColors: false,
        sizeAttenuation: true
      })
    }

    return { geometry: geo, material: mat }
  }, [particleCount, weatherType, windStrength])

  // Update particles
  useFrame((state, delta) => {
    if (!particlesRef.current || !geometry) return

    const positions = geometry.attributes.position.array as Float32Array
    const velocities = geometry.attributes.velocity.array as Float32Array

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3

      // Update positions based on velocities
      positions[i3] += velocities[i3] * delta
      positions[i3 + 1] += velocities[i3 + 1] * delta
      positions[i3 + 2] += velocities[i3 + 2] * delta

      // Reset particles that fall below ground or move too far from player
      const particlePos = new THREE.Vector3(positions[i3], positions[i3 + 1], positions[i3 + 2])
      const distanceFromPlayer = particlePos.distanceTo(playerPosition)

      if (positions[i3 + 1] < 0 || distanceFromPlayer > 150) {
        // Respawn particle above and around player
        positions[i3] = playerPosition.x + (Math.random() - 0.5) * 200
        positions[i3 + 1] = playerPosition.y + 50 + Math.random() * 50
        positions[i3 + 2] = playerPosition.z + (Math.random() - 0.5) * 200

        // Reset velocity
        if (weatherType === WeatherType.RAIN || weatherType === WeatherType.THUNDERSTORM) {
          velocities[i3] = (Math.random() - 0.5) * windStrength * 2
          velocities[i3 + 1] = -10 - Math.random() * 5
          velocities[i3 + 2] = (Math.random() - 0.5) * windStrength * 2
        } else {
          velocities[i3] = (Math.random() - 0.5) * windStrength
          velocities[i3 + 1] = -2 - Math.random() * 2
          velocities[i3 + 2] = (Math.random() - 0.5) * windStrength
        }
      }

      // Apply wind effects
      velocities[i3] += (Math.random() - 0.5) * windStrength * 0.1 * delta
      velocities[i3 + 2] += (Math.random() - 0.5) * windStrength * 0.1 * delta
    }

    geometry.attributes.position.needsUpdate = true
    geometry.attributes.velocity.needsUpdate = true
  })

  // Update material opacity based on weather intensity
  useEffect(() => {
    if (material) {
      material.opacity = effects.visibility * 0.6
    }
  }, [material, effects.visibility])

  if (particleCount === 0 || !geometry || !material) {
    return null
  }

  return (
    <points ref={particlesRef} geometry={geometry} material={material} />
  )
} 