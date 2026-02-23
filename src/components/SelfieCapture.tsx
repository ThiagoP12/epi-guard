import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, RotateCcw, Check } from 'lucide-react';

interface SelfieCaptureProps {
  onCaptureChange: (dataUrl: string | null) => void;
  label?: string;
}

export default function SelfieCapture({ onCaptureChange, label = 'Selfie do Colaborador *' }: SelfieCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [captured, setCaptured] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err: any) {
      setError('Não foi possível acessar a câmera. Verifique as permissões.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const MAX_SELFIE_BYTES = 500 * 1024; // 500KB

  const capture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const size = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Crop center square
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;
    ctx.drawImage(video, sx, sy, size, size, 0, 0, 400, 400);

    let quality = 0.7;
    let dataUrl = canvas.toDataURL('image/jpeg', quality);

    // Reduce quality if still too large
    while (dataUrl.length > MAX_SELFIE_BYTES * 1.37 && quality > 0.2) {
      quality -= 0.1;
      dataUrl = canvas.toDataURL('image/jpeg', quality);
    }

    if (dataUrl.length > MAX_SELFIE_BYTES * 1.37) {
      setError('Imagem muito grande. Tente novamente com melhor iluminação.');
      return;
    }

    setCaptured(dataUrl);
    onCaptureChange(dataUrl);
    stopCamera();
  }, [onCaptureChange, stopCamera]);

  const retake = useCallback(() => {
    setCaptured(null);
    onCaptureChange(null);
    startCamera();
  }, [onCaptureChange, startCamera]);

  return (
    <div className="w-full">
      <p className="text-xs font-medium mb-2">{label}</p>
      <canvas ref={canvasRef} className="hidden" />

      {!cameraActive && !captured && (
        <button
          type="button"
          onClick={startCamera}
          className="w-full border-2 border-dashed rounded-xl p-6 flex flex-col items-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors bg-card"
        >
          <Camera size={28} className="opacity-50" />
          <span className="text-xs">Toque para abrir a câmera e tirar uma selfie</span>
        </button>
      )}

      {error && (
        <p className="text-xs text-destructive mt-1">{error}</p>
      )}

      {cameraActive && (
        <div className="relative rounded-xl overflow-hidden border-2 border-primary bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full aspect-square object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={stopCamera}
              className="h-8 text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={capture}
              className="h-8 text-xs gap-1"
            >
              <Camera size={14} /> Capturar
            </Button>
          </div>
        </div>
      )}

      {captured && (
        <div className="relative">
          <div className="rounded-xl overflow-hidden border-2 border-primary/30">
            <img src={captured} alt="Selfie capturada" className="w-full aspect-square object-cover" />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Check size={12} className="text-primary" /> Foto capturada
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={retake}
              className="text-xs h-7 px-2 text-muted-foreground hover:text-destructive"
            >
              <RotateCcw size={13} className="mr-1" /> Nova foto
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
