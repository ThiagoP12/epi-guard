import { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Eraser, PenLine } from 'lucide-react';

interface SignatureCanvasProps {
  onSignatureChange: (dataUrl: string | null) => void;
}

export default function SignatureCanvas({ onSignatureChange }: SignatureCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const lastPoint = useRef<{ x: number; y: number; time: number } | null>(null);
  const [dimensions, setDimensions] = useState({ width: 460, height: 160 });

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

  // Setup canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    canvas.style.width = `${dimensions.width}px`;
    canvas.style.height = `${dimensions.height}px`;
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'hsl(215, 70%, 22%)';

    // Draw signature guide line
    drawGuideLine(ctx, dimensions.width, dimensions.height);
  }, [dimensions]);

  const drawGuideLine = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'hsl(215, 20%, 85%)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(24, h * 0.72);
    ctx.lineTo(w - 24, h * 0.72);
    ctx.stroke();
    ctx.restore();

    // Small "x" mark
    ctx.save();
    ctx.font = '13px system-ui';
    ctx.fillStyle = 'hsl(215, 20%, 75%)';
    ctx.fillText('✕', 16, h * 0.72 - 4);
    ctx.restore();
  };

  const getPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
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
    if ('clientX' in e) {
      return {
        x: ((e as React.MouseEvent).clientX - rect.left) * scaleX,
        y: ((e as React.MouseEvent).clientY - rect.top) * scaleY,
      };
    }
    return { x: 0, y: 0 };
  }, [dimensions]);

  const getLineWidth = (x: number, y: number) => {
    if (!lastPoint.current) return 2;
    const dt = Date.now() - lastPoint.current.time;
    const dx = x - lastPoint.current.x;
    const dy = y - lastPoint.current.y;
    const speed = Math.sqrt(dx * dx + dy * dy) / Math.max(dt, 1);
    // Faster movement = thinner line (pen pressure simulation)
    return Math.max(1.2, Math.min(3.5, 3.5 - speed * 0.8));
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.strokeStyle = 'hsl(215, 70%, 22%)';
    ctx.setLineDash([]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    lastPoint.current = { x: pos.x, y: pos.y, time: Date.now() };
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext('2d');
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
    if (!isDrawing) return;
    setIsDrawing(false);
    lastPoint.current = null;
    setHasSignature(true);
    const canvas = canvasRef.current;
    if (canvas) {
      onSignatureChange(canvas.toDataURL('image/png'));
    }
  };

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
          borderColor: isDrawing ? 'hsl(var(--primary))' : undefined,
        }}
      >
        <canvas
          ref={canvasRef}
          className="cursor-crosshair touch-none w-full"
          style={{ height: dimensions.height }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {!hasSignature && !isDrawing && (
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
