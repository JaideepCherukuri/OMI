// @ts-nocheck — orbdesign original, Uint8Array types differ in strict TS
import { useRef, useState, useCallback, useEffect } from 'react';

export type OrbMode = 'IDLE' | 'MIC' | 'SIM';

interface UseOrbAudioReturn {
  mode: OrbMode;
  startMic: () => Promise<void>;
  startSim: () => void;
  stopAll: () => void;
  getFrequencyData: () => number;
  getAmplitude: () => number;
  getSpectrum: () => Uint8Array | null;
}

export const useOrbAudio = (): UseOrbAudioReturn => {
  const [mode, setMode] = useState<OrbMode>('IDLE');
  
  // Refs for audio processing
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Data arrays
  const freqDataRef = useRef<Uint8Array | null>(null); // For volume calc
  const timeDataRef = useRef<Uint8Array | null>(null); // For amplitude calc
  const spectrumDataRef = useRef<Uint8Array | null>(null); // For visualizer
  
  // Simulation refs
  const simIntervalRef = useRef<number | null>(null);
  const simAmplitudeRef = useRef(0);
  
  // Volume smoothing for frequency (legacy support)
  const currentVolRef = useRef(0);
  const targetVolRef = useRef(0);

  const stopAll = useCallback(() => {
    // Stop simulation
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }

    // Stop mic stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // Close Audio Context
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(console.error);
      audioCtxRef.current = null;
    }

    analyserRef.current = null;
    sourceRef.current = null;
    freqDataRef.current = null;
    timeDataRef.current = null;
    spectrumDataRef.current = null;
    targetVolRef.current = 0;
    simAmplitudeRef.current = 0;
    
    setMode('IDLE');
  }, []);

  const startMic = useCallback(async () => {
    stopAll();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      audioCtxRef.current = ctx;
      
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512; 
      analyser.smoothingTimeConstant = 0.6; 
      analyserRef.current = analyser;
      
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceRef.current = source;
      
      freqDataRef.current = new Uint8Array(analyser.frequencyBinCount);
      timeDataRef.current = new Uint8Array(analyser.fftSize);
      spectrumDataRef.current = new Uint8Array(analyser.frequencyBinCount);
      
      setMode('MIC');
    } catch (e) {
      console.error("Mic Error:", e);
      stopAll();
    }
  }, [stopAll]);

  const startSim = useCallback(() => {
    stopAll();
    setMode('SIM');
    
    spectrumDataRef.current = new Uint8Array(128);

    let t = 0;
    simIntervalRef.current = window.setInterval(() => {
      t += 0.1;
      let w = Math.sin(t * 3) * Math.cos(t * 1.5); 
      if (Math.random() > 0.7) w += 0.5;
      
      w = Math.max(0, w);
      w = Math.min(1, w);
      
      simAmplitudeRef.current = w;
      targetVolRef.current = w * 0.7;
    }, 50);
  }, [stopAll]);

  const getFrequencyData = useCallback(() => {
    if (mode === 'MIC' && analyserRef.current && freqDataRef.current) {
      analyserRef.current.getByteFrequencyData(freqDataRef.current);
      
      let sum = 0;
      const startBin = 1;
      const endBin = 32;
      const count = endBin - startBin;
      
      for (let i = startBin; i < endBin; i++) {
        sum += freqDataRef.current[i];
      }
      
      let avg = sum / count;
      let normalized = avg / 255;
      
      const NOISE_FLOOR = 0.2;
      if (normalized < NOISE_FLOOR) {
        normalized = 0;
      } else {
        normalized = (normalized - NOISE_FLOOR) / (1 - NOISE_FLOOR);
        normalized = Math.pow(normalized, 2.5); 
      }
      
      targetVolRef.current = normalized * 1.4;
    }
    
    let target = targetVolRef.current;
    target = Math.min(1.0, Math.max(0.0, target));
    
    currentVolRef.current += (target - currentVolRef.current) * 0.2;
    
    return currentVolRef.current;
  }, [mode]);

  const getAmplitude = useCallback(() => {
    if (mode === 'SIM') {
      return simAmplitudeRef.current;
    }

    if (mode === 'MIC' && analyserRef.current && timeDataRef.current) {
      analyserRef.current.getByteTimeDomainData(timeDataRef.current);
      
      let sumSquares = 0;
      for (let i = 0; i < timeDataRef.current.length; i++) {
        const normalized = (timeDataRef.current[i] - 128) / 128;
        sumSquares += normalized * normalized;
      }
      let rms = Math.sqrt(sumSquares / timeDataRef.current.length);
      
      const NOISE_FLOOR_RMS = 0.1;
      if (rms < NOISE_FLOOR_RMS) {
        rms = 0;
      } else {
        rms = (rms - NOISE_FLOOR_RMS) / (1 - NOISE_FLOOR_RMS);
        rms = Math.pow(rms, 1.2);
        rms *= 2.5;
      }
      
      return rms;
    }
    
    return 0;
  }, [mode]);

  const getSpectrum = useCallback(() => {
    if (mode === 'MIC' && analyserRef.current && spectrumDataRef.current) {
      analyserRef.current.getByteFrequencyData(spectrumDataRef.current);
      return spectrumDataRef.current;
    }
    
    if (mode === 'SIM' && spectrumDataRef.current) {
      const arr = spectrumDataRef.current;
      const time = Date.now() / 1000;
      for (let i = 0; i < arr.length; i++) {
        const v = Math.sin(i * 0.1 + time * 5) * 50 + 
                  Math.cos(i * 0.2 - time * 2) * 30 + 
                  (simAmplitudeRef.current * 150 * (1 - i/arr.length));
        arr[i] = Math.max(0, Math.min(255, v));
      }
      return arr;
    }

    return null;
  }, [mode]);

  useEffect(() => {
    return () => stopAll();
  }, [stopAll]);

  return {
    mode,
    startMic,
    startSim,
    stopAll,
    getFrequencyData,
    getAmplitude,
    getSpectrum
  };
};
