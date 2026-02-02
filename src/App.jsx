import React, { useState, useEffect, Suspense, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, MapControls, ContactShadows, Environment, Float, Stars, Sparkles } from '@react-three/drei'
import Watch from './components/Watch'
import './App.css'

function App() {
  const backgrounds = [
    { id: 'default', css: 'linear-gradient(to bottom right, #1a2a6c, #b21f1f, #fdbb2d)' },
    { id: 'dark', css: 'linear-gradient(to bottom right, #000000, #434343)' },
    { id: 'moon', css: 'linear-gradient(to bottom, #0f2027, #203a43, #2c5364)' }, // Moon Theme
    { id: 'sun', css: 'linear-gradient(to bottom, #fceabb, #f8b500)' },         // Sun Theme
  ]

  const [mode, setMode] = useState('clock') // 'clock' | 'timer'
  const [activeBg, setActiveBg] = useState(backgrounds[0])


  // Clock State
  const [clockTime, setClockTime] = useState(new Date())

  // Timer State
  const [timerInputH, setTimerInputH] = useState(0)
  const [timerInputM, setTimerInputM] = useState(0)
  const [timerInputS, setTimerInputS] = useState(0)

  const [targetTime, setTargetTime] = useState(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [userName, setUserName] = useState('')
  const [hasSpoken, setHasSpoken] = useState(false)

  const workerRef = useRef(null)

  // Audio Refs (For background playback)
  const audioCtxRef = useRef(null)

  // Sound Helpers
  const playTickSound = () => {
    // Lazy Init
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => { });
    }

    const ctx = audioCtxRef.current;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

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

  const playBellSound = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => { });
    }
    const ctx = audioCtxRef.current;

    const playChime = (delay) => {
      const t = ctx.currentTime + delay;
      const funders = [300, 600, 900, 1500];
      funders.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = i === 0 ? 'sine' : 'square';
        osc.frequency.setValueAtTime(freq, t);

        const vol = 0.2 / (i + 1);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(vol, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 2.5);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 2.6);
      });
    }
    playChime(0);
    playChime(2.0);
    playChime(4.0);
  }

  // TTS Helper
  const speakNotification = (name) => {
    const msg = new SpeechSynthesisUtterance(`Aapka samay samapt hua, ${name}`);
    msg.lang = 'hi-IN';
    msg.rate = 0.9;
    window.speechSynthesis.speak(msg);
  }

  // Notification Helper
  const sendSystemNotification = (name) => {
    if (Notification.permission === 'granted') {
      new Notification("Time's Up!", {
        body: `Aapka samay samapt hua, ${name}`,
        icon: '/vite.svg'
      });
    }
  }

  // Init Worker & Permissions
  useEffect(() => {
    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }

    // Initialize Worker
    workerRef.current = new Worker(new URL('./timer.worker.js', import.meta.url), { type: 'module' });

    workerRef.current.onmessage = (e) => {
      const { type, timeLeft: workerTimeLeft } = e.data;

      if (type === 'TICK') {
        setTimeLeft(workerTimeLeft);
        document.title = workerTimeLeft > 0 ? `(${workerTimeLeft}s) Timer` : 'Time Up!';

        // Play Tick via Worker Event (Robust Background Audio)
        if (workerTimeLeft > 0) playTickSound();
        if (workerTimeLeft === 0) playBellSound();
      }
    };

    return () => {
      workerRef.current.terminate();
    }
  }, [])

  // Effects
  // Effects
  useEffect(() => {
    let interval = null;

    // Clock update
    if (mode === 'clock') {
      interval = setInterval(() => {
        setClockTime(new Date())
        document.title = "Wall Watch";
      }, 1000)
    }
    // Timer Logic
    else if (mode === 'timer') {
      // UI Side Effects at 0
      if (timeLeft <= 0 && isRunning && !hasSpoken && targetTime && timeLeft > -2) {
        speakNotification(userName || "User");
        sendSystemNotification(userName || "User");
        setHasSpoken(true);
      }

      // Fallback/Negative Overtime Logic (Worker stops at 0)
      if (timeLeft <= 0 && isRunning && targetTime) {
        interval = setInterval(() => {
          const now = new Date();
          const diff = Math.ceil((targetTime - now) / 1000);
          setTimeLeft(diff);
          document.title = `(${diff}s) Time Over`;
        }, 1000)
      }
    }

    return () => clearInterval(interval)
  }, [mode, isRunning, targetTime, hasSpoken, userName, timeLeft])

  // Helpers
  const handleStartTimer = () => {
    if (!userName.trim()) {
      alert("Please enter your name first!");
      return;
    }

    // Calculate target only if we are starting fresh or resuming
    // If resuming from pause, we need to recalculate target based on timeLeft?
    // Simplified: Just Start/Stop.

    if (!isRunning) {
      // Starting or Resuming
      let durationSeconds = 0;
      if (timeLeft > 0 && targetTime) {
        // Resuming? Actually current logic resets target on stop.
        // Let's assume Start always sets new target from Inputs.
      }

      // Calculate total seconds from inputs
      const totalSeconds = (parseInt(timerInputH) || 0) * 3600 + (parseInt(timerInputM) || 0) * 60 + (parseInt(timerInputS) || 0)

      if (totalSeconds > 0) {
        const now = new Date();
        const target = new Date(now.getTime() + totalSeconds * 1000);
        setTargetTime(target);
        setTimeLeft(totalSeconds);
        setIsRunning(true);
        setHasSpoken(false);

        // Start Worker
        if (workerRef.current) {
          workerRef.current.postMessage({ action: 'START', payload: { targetTime: target } });
        }
      }
    }
  }

  const handleStopTimer = () => {
    setIsRunning(false)
    setTargetTime(null)
    document.title = "Timer Stopped";
    if (workerRef.current) workerRef.current.postMessage({ action: 'STOP' });
  }

  const handleResetTimer = () => {
    setIsRunning(false)
    setTargetTime(null)
    setTimeLeft(0)
    setTimerInputH(0)
    setTimerInputM(0)
    setTimerInputS(0)
    setHasSpoken(false)
    document.title = "3D Timer";
    if (workerRef.current) workerRef.current.postMessage({ action: 'STOP' });
  }

  // Convert timeLeft to Date-like object or props for Watch
  const getWatchTime = () => {
    if (mode === 'clock') return clockTime;

    // Construct date from timeLeft
    const h = Math.floor(timeLeft / 3600)
    const m = Math.floor((timeLeft % 3600) / 60)
    const s = timeLeft % 60

    // We create a dummy date with these values
    const d = new Date()
    d.setHours(h)
    d.setMinutes(m)
    d.setSeconds(s)
    d.setMilliseconds(0)
    return d
  }



  return (
    <div className="app-container" style={{ width: '100vw', height: '100vh', background: activeBg.css }}>
      <div className="canvas-container">
        <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
          <ambientLight intensity={0.5} />
          <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
          <pointLight position={[-10, -10, -10]} intensity={0.5} />

          <Suspense fallback={null}>
            <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
              <Watch time={getWatchTime()} mode={mode} isRunning={isRunning} timeLeft={mode === 'timer' ? timeLeft : null} />
            </Float>
            <Environment preset="city" />
            <ContactShadows position={[0, -4, 0]} opacity={0.6} scale={40} blur={2} far={4} color="#00d2ff" />

            {/* Dynamic Background Elements */}
            {activeBg.id === 'moon' && (
              <group position={[-5, 3, -10]}>
                {/* Moon */}
                <mesh>
                  <sphereGeometry args={[2, 32, 32]} />
                  <meshStandardMaterial color="#ddd" roughness={0.8} metalness={0.1} />
                </mesh>
                <pointLight instance={0.5} distance={20} color="#aaf" />
                <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
              </group>
            )}

            {activeBg.id === 'sun' && (
              <group position={[5, 4, -10]}>
                {/* Sun */}
                <mesh>
                  <sphereGeometry args={[3, 32, 32]} />
                  <meshBasicMaterial color="#ffdd00" />
                </mesh>
                {/* Sun Glow/Rays */}
                <mesh scale={[1.2, 1.2, 1.2]}>
                  <sphereGeometry args={[3, 32, 32]} />
                  <meshBasicMaterial color="#ffaa00" transparent opacity={0.3} />
                </mesh>
                <ambientLight intensity={1.5} />
                <Sparkles count={500} scale={20} size={5} speed={0.4} opacity={0.5} color="#ffffaa" />
              </group>
            )}

            {/* Default Stars for other dark themes */}
            {['default', 'dark'].includes(activeBg.id) && (
              <>
                <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
                <Sparkles count={1000} scale={10} size={1.5} speed={0.5} opacity={0.7} />
              </>
            )}

          </Suspense>

          <OrbitControls enablePan={false} enableZoom={true} minDistance={4} maxDistance={12} />
        </Canvas>
      </div>

      <div className="ui-overlay">
        <h1 className="title">{mode === 'clock' ? 'Wall Watch' : '3D Timer'}</h1>

        <div className="controls-container">
          <div className="controls-header">
            <button
              className={`mode-btn ${mode === 'clock' ? 'active' : ''}`}
              onClick={() => { setMode('clock'); setIsRunning(false); }}
            >
              Time
            </button>
            <button
              className={`mode-btn ${mode === 'timer' ? 'active' : ''}`}
              onClick={() => setMode('timer')}
            >
              Timer
            </button>
          </div>

          {mode === 'timer' && (
            <>
              <div className="timer-display" style={{ textAlign: 'center', fontSize: '2rem', marginBottom: '20px', fontFamily: 'monospace', color: timeLeft < 0 ? '#ff4444' : 'white' }}>
                {timeLeft < 0 ? '-' : ''}
                {Math.floor(Math.abs(timeLeft) / 3600).toString().padStart(2, '0')}:
                {Math.floor((Math.abs(timeLeft) % 3600) / 60).toString().padStart(2, '0')}:
                {(Math.abs(timeLeft) % 60).toString().padStart(2, '0')}
              </div>

              {!isRunning && (
                <div style={{ marginBottom: '15px', textAlign: 'center' }}>
                  <input
                    type="text"
                    placeholder="Enter Your Name"
                    value={userName}
                    onChange={e => setUserName(e.target.value)}
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      border: 'none',
                      width: '80%',
                      background: 'rgba(255,255,255,0.2)',
                      color: 'white',
                      fontSize: '1rem',
                      textAlign: 'center'
                    }}
                  />
                </div>
              )}

              {!isRunning && timeLeft <= 0 && (
                <div className="timer-inputs">
                  <input type="number" placeholder="H" className="time-input"
                    value={timerInputH} onChange={e => setTimerInputH(e.target.value)} min="0" max="12" />
                  <input type="number" placeholder="M" className="time-input"
                    value={timerInputM} onChange={e => setTimerInputM(e.target.value)} min="0" max="59" />
                  <input type="number" placeholder="S" className="time-input"
                    value={timerInputS} onChange={e => setTimerInputS(e.target.value)} min="0" max="59" />
                </div>
              )}

              <div className="actions">
                {!isRunning ? (
                  <button className="action-btn btn-start" onClick={handleStartTimer}>
                    {timeLeft > 0 ? 'Resume' : 'Start'}
                  </button>
                ) : (
                  <button className="action-btn btn-stop" onClick={handleStopTimer}>Stop</button>
                )}
                <button className="action-btn btn-reset" onClick={handleResetTimer}>Reset</button>
              </div>
            </>
          )}

          <div className="bg-picker">
            {backgrounds.map((bg, i) => (
              <div
                key={bg.id}
                className="bg-option"
                style={{ background: bg.css, transform: activeBg.id === bg.id ? 'scale(1.2)' : 'scale(1)' }}
                onClick={() => setActiveBg(bg)}
                title={bg.id}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
