private static playWebAudioBeep(tone: number = 600, duration: number = 0.8): void {
  console.log('🔊 playWebAudioBeep: Trying Web Audio API beep...');
  console.log('🔊 playWebAudioBeep: Tone:', tone, 'Hz, Duration:', duration, 's');

  try {
    // Create a new audio context each time to avoid state issues
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Use the provided tone and duration, or defaults
    oscillator.frequency.setValueAtTime(tone, audioContext.currentTime);
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);

    console.log('✅ playWebAudioBeep: Web Audio API beep played successfully');

  } catch (error) {
    console.log('❌ playWebAudioBeep: All audio methods failed:', error);
  }
}