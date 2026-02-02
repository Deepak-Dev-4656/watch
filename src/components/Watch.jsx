import React, { useRef, useLayoutEffect, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
// We can use roundedBox for better hands if we had it, but standard geometries work.
import { Html, Text, Torus, Cylinder, Box } from '@react-three/drei'
import * as THREE from 'three'

// Hook for Tick Sound
const useTickSound = () => {
    const audioCtxRef = useRef(null);

    const playTick = () => {
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') ctx.resume().catch(() => { });

        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        // "Tick-Tock" mechanical sound
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(2000, t);
        osc.frequency.exponentialRampToValueAtTime(800, t + 0.01);

        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(t);
        osc.stop(t + 0.06);
    }

    return playTick;
}

// Hook for Bell Sound (3 distinct rings)
const useBellSound = () => {
    const audioCtxRef = useRef(null);

    // Play a single Ring
    const playSingleRing = (delay = 0) => {
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') ctx.resume().catch(() => { });

        const t = ctx.currentTime + delay;

        // Deep Temple Bell Sound
        const funders = [300, 600, 900, 1500];

        funders.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = i === 0 ? 'sine' : 'square'; // Mix sine/square for richness
            osc.frequency.setValueAtTime(freq, t);

            const volume = 0.2 / (i + 1);
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(volume, t + 0.02); // quick attack
            gain.gain.exponentialRampToValueAtTime(0.001, t + 2.5); // long decay

            // Lowpass filter for muffling higher harmonics over time (softer sound)
            const filter = ctx.createBiquadFilter();
            filter.type = "lowpass";
            filter.frequency.setValueAtTime(5000, t);
            filter.frequency.exponentialRampToValueAtTime(200, t + 2);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);

            osc.start(t);
            osc.stop(t + 2.6);
        });
    }

    const playAlarmSequence = () => {
        // "3 bad tan se aawaz kare" -> Ring 3 times.
        playSingleRing(0);
        playSingleRing(2.0); // Wait 2s
        playSingleRing(4.0); // Wait 4s
    }

    return playAlarmSequence;
}

export default function Watch({ time, mode, isRunning, timeLeft }) {
    const hourHand = useRef()
    const minuteHand = useRef()
    const secondHand = useRef()
    const pendulum = useRef()

    const playTick = useTickSound()
    const playAlarm = useBellSound()

    const lastSecond = useRef(time.getSeconds())
    const hasRung = useRef(false)

    // Reset ring state
    useEffect(() => {
        if (timeLeft > 0 || timeLeft < -10) { // Reset if we reset timer
            hasRung.current = false;
        }
    }, [timeLeft])

    useFrame((state) => {
        const h = time.getHours() % 12
        const m = time.getMinutes()
        const s = time.getSeconds()

        const sAngle = s * 6
        const mAngle = (m + s / 60) * 6
        const hAngle = (h + m / 60) * 30

        // animate hands
        // Introducting "elastic" tick for second hand?
        // We can do simple lerp for smoothness or direct assignment for tick
        if (secondHand.current) {
            secondHand.current.rotation.z = -THREE.MathUtils.degToRad(sAngle)
        }
        if (minuteHand.current) {
            minuteHand.current.rotation.z = -THREE.MathUtils.degToRad(mAngle)
        }
        if (hourHand.current) {
            hourHand.current.rotation.z = -THREE.MathUtils.degToRad(hAngle)
        }

        // Rotate internal gears or pendulum for visual interest
        if (pendulum.current) {
            pendulum.current.rotation.z = Math.sin(state.clock.elapsedTime * 2) * 0.2
        }

        // Sound Logic
        if (lastSecond.current !== s) {
            if (mode === 'clock' || isRunning) {
                playTick()
            }

            // Bell Logic: Trigger exactly at 0
            if (mode === 'timer' && timeLeft === 0 && !hasRung.current) {
                playAlarm();
                hasRung.current = true;
            }

            lastSecond.current = s
        }
    })

    // Materials
    const neonBlue = new THREE.MeshBasicMaterial({ color: '#00ffff' })
    const neonPink = new THREE.MeshBasicMaterial({ color: '#ff00ff' })
    const glassMat = new THREE.MeshPhysicalMaterial({
        color: '#ffffff',
        transmission: 0.95,
        opacity: 0.1,
        metalness: 0.1,
        roughness: 0,
        thickness: 1
    })
    const metallicDark = new THREE.MeshStandardMaterial({
        color: '#111',
        metalness: 0.9,
        roughness: 0.1
    })

    return (
        <group rotation={[0, 0, 0]}>

            {/* --- Sci-Fi / Cyberpunk Chassis --- */}

            {/* Hover Ring (Outer glow) */}
            <mesh position={[0, 0, -0.2]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[5.5, 0.1, 16, 100]} />
                <meshBasicMaterial color="#00d2ff" />
            </mesh>

            {/* Main Body Ring */}
            <mesh position={[0, 0, 0]}>
                <torusGeometry args={[5, 0.3, 32, 100]} />
                <meshStandardMaterial color="#222" metalness={0.8} roughness={0.2} />
            </mesh>

            {/* Internal Mechanism (Z-fighting prevention with position) */}
            <group position={[0, 0, -0.1]}>
                <mesh>
                    <cylinderGeometry args={[4.8, 4.8, 0.2, 64]} />
                    <meshStandardMaterial color="#0a0a0a" metalness={0.9} roughness={0.5} />
                </mesh>

                {/* Decorative Gear 1 */}
                <mesh position={[1.5, 1.5, 0.11]} rotation={[0, 0, 0.5]}>
                    <cylinderGeometry args={[1, 1, 0.05, 12]} />
                    <meshStandardMaterial color="#333" metalness={0.8} />
                </mesh>
                {/* Decorative Gear 2 */}
                <mesh position={[-1, -2, 0.11]}>
                    <cylinderGeometry args={[1.5, 1.5, 0.05, 12]} />
                    <meshStandardMaterial color="#444" metalness={0.8} />
                </mesh>
            </group>

            {/* Markers: Floating Neon Indicators */}
            {Array.from({ length: 12 }).map((_, i) => {
                const angle = (i * 30) * (Math.PI / 180)
                const radius = 4.2
                const x = Math.sin(angle) * radius
                const y = Math.cos(angle) * radius

                return (
                    <group key={i} position={[x, y, 0.2]} rotation={[0, 0, -angle]}>
                        <mesh>
                            <boxGeometry args={[0.2, 0.6, 0.05]} />
                            <meshStandardMaterial color="#fff" emissive="#00ffff" emissiveIntensity={0.8} />
                        </mesh>
                    </group>
                )
            })}

            {/* Minute ticks */}
            {Array.from({ length: 60 }).map((_, i) => {
                if (i % 5 === 0) return null; // Skip hours
                const angle = (i * 6) * (Math.PI / 180)
                const radius = 4.5
                const x = Math.sin(angle) * radius
                const y = Math.cos(angle) * radius
                return (
                    <mesh key={i} position={[x, y, 0.2]} rotation={[0, 0, -angle]}>
                        <boxGeometry args={[0.05, 0.1, 0.02]} />
                        <meshStandardMaterial color="#555" />
                    </mesh>
                )
            })}

            {/* --- HANDS --- */}

            {/* Center cap */}
            <mesh position={[0, 0, 0.6]}>
                <cylinderGeometry args={[0.3, 0.3, 0.1, 32]} rotation={[Math.PI / 2, 0, 0]} />
                <meshStandardMaterial color="gold" metalness={1} roughness={0.1} />
            </mesh>

            {/* Hour Hand (Skeleton Style) */}
            <group ref={hourHand} position={[0, 0, 0.3]}>
                <mesh position={[0, 1, 0]}>
                    <boxGeometry args={[0.6, 2.5, 0.05]} />
                    <meshStandardMaterial color="black" metalness={0.8} />
                </mesh>
                {/* Glow strip */}
                <mesh position={[0, 1, 0.04]}>
                    <boxGeometry args={[0.2, 2, 0.02]} />
                    <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={1} />
                </mesh>
            </group>

            {/* Minute Hand */}
            <group ref={minuteHand} position={[0, 0, 0.4]}>
                <mesh position={[0, 1.8, 0]}>
                    <boxGeometry args={[0.4, 4, 0.05]} />
                    <meshStandardMaterial color="black" metalness={0.8} />
                </mesh>
                {/* Glow strip */}
                <mesh position={[0, 1.8, 0.04]}>
                    <boxGeometry args={[0.15, 3.5, 0.02]} />
                    <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={1} />
                </mesh>
            </group>

            {/* Second Hand (The "Kata") - Red & Sharp */}
            <group ref={secondHand} position={[0, 0, 0.5]}>
                <mesh position={[0, 1.2, 0]}>
                    <cylinderGeometry args={[0.03, 0.08, 6, 8]} />
                    <meshStandardMaterial color="#ff0055" emissive="#ff0055" emissiveIntensity={1} />
                </mesh>
                <mesh position={[0, -1, 0]}>
                    <sphereGeometry args={[0.15]} />
                    <meshStandardMaterial color="#ff0055" />
                </mesh>
            </group>

            {/* Glass */}
            <mesh position={[0, 0, 0.5]}>
                <sphereGeometry args={[5.2, 64, 16, 0, Math.PI * 2, 0, 0.4]} />
                <meshPhysicalMaterial
                    transparent
                    opacity={0.1}
                    metalness={0.9}
                    roughness={0}
                    transmission={0.9}
                    color="#aaf"
                />
            </mesh>

        </group>
    )
}
