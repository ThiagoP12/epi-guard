import { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Eraser, PenLine } from 'lucide-react';

interface SignatureCanvasProps {
  onSignatureChange: (dataUrl: string | null) => void;
}

export default function SignatureCanvas({ onSignatureChange }: SignatureCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);
  const lastPoint = useRef<{ x: number; y: number; time: number } | null>(null);
  const [dimensions, setDimensions] = useState({ width: 460, height: 160 });
  const [drawingActive, setDrawingActive] = useState(false); // only for UI (border highlight)

  // Responsive sizing
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth;
        setDimensions({ width: w, height: Math.max(140, Math.min(180, w * 0.35)) });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const drawGuideLine = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'hsl(215, 20%, 85%)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(24, h * 0.72);
    ctx.lineTo(w - 24, h * 0.72);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.font = '13px system-ui';
    ctx.fillStyle = 'hsl(215, 20%, 75%)';
    ctx.fillText('✕', 16, h * 0.72 - 4);
    ctx.restore();
  }, []);

  // Setup canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'hsl(215, 70%, 22%)';

    drawGuideLine(ctx, dimensions.width, dimensions.height);
  }, [dimensions, drawGuideLine]);

  const getPos = useCallback((e: MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = dimensions.width / rect.width;
    const scaleY = dimensions.height / rect.height;
    if ('touches' in e && e.touches.length > 0) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: ((e as MouseEvent).clientX - rect.left) * scaleX,
      y: ((e as MouseEvent).clientY - rect.top) * scaleY,
    };
  }, [dimensions]);

  const getLineWidth = useCallback((x: number, y: number) => {
    if (!lastPoint.current) return 2;
    const dt = Date.now() - lastPoint.current.time;
    const dx = x - lastPoint.current.x;
    const dy = y - lastPoint.current.y;
    const speed = Math.sqrt(dx * dx + dy * dy) / Math.max(dt, 1);
    return Math.max(1.2, Math.min(3.5, 3.5 - speed * 0.8));
  }, []);

  // Use native event listeners to avoid React synthetic event delays
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const startDrawing = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const pos = getPos(e);
      ctx.strokeStyle = 'hsl(215, 70%, 22%)';
      ctx.setLineDash([]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      lastPoint.current = { x: pos.x, y: pos.y, time: Date.now() };
      isDrawingRef.current = true;
      setDrawingActive(true);
    };

    const draw = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      if (!isDrawingRef.current) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const pos = getPos(e);

      ctx.strokeStyle = 'hsl(215, 70%, 22%)';
      ctx.setLineDash([]);
      ctx.lineWidth = getLineWidth(pos.x, pos.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);

      lastPoint.current = { x: pos.x, y: pos.y, time: Date.now() };
    };

    const stopDrawing = () => {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;
      lastPoint.current = null;
      setDrawingActive(false);
      setHasSignature(true);
      onSignatureChange(canvas.toDataURL('image/png'));
    };

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);
    canvas.addEventListener('touchstart', startDrawing, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);

    return () => {
      canvas.removeEventListener('mousedown', startDrawing);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', stopDrawing);
      canvas.removeEventListener('mouseleave', stopDrawing);
      canvas.removeEventListener('touchstart', startDrawing);
      canvas.removeEventListener('touchmove', draw);
      canvas.removeEventListener('touchend', stopDrawing);
    };
  }, [dimensions, getPos, getLineWidth, onSignatureChange]);

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, dimensions.width, dimensions.height);
    drawGuideLine(ctx, dimensions.width, dimensions.height);
    setHasSignature(false);
    lastPoint.current = null;
    onSignatureChange(null);
  };

  return (
    <div ref={containerRef} className="w-full">
      <div
        className="border-2 border-dashed rounded-xl overflow-hidden bg-card relative transition-colors duration-150"
        style={{
          borderColor: drawingActive ? 'hsl(var(--primary))' : undefined,
        }}
      >
        <canvas
          ref={canvasRef}
          className="cursor-crosshair touch-none block"
          style={{ width: dimensions.width, height: dimensions.height }}
        />
        {!hasSignature && !drawingActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-1.5">
            <PenLine size={20} className="text-muted-foreground/40" />
            <span className="text-muted-foreground/60 text-xs">Assine aqui com o mouse ou dedo</span>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[10px] text-muted-foreground/50">
          {hasSignature ? '✓ Assinatura capturada' : 'Obrigatório'}
        </span>
        {hasSignature && (
          <Button variant="ghost" size="sm" onClick={clear} className="text-xs h-7 px-2 text-muted-foreground hover:text-destructive">
            <Eraser size={13} className="mr-1" /> Limpar
          </Button>
        )}
      </div>
    </div>
  );
}
