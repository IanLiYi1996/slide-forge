/**
 * Image Annotation Canvas
 *
 * Allows users to draw various shapes on images for annotation/highlighting
 * Supports: Circle, Rectangle, Arrow, Free Draw
 */

'use client';

import { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Circle, Square, ArrowRight, Pen, Eraser, Undo } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface ImageAnnotationCanvasProps {
  imageDataUrl: string;
  onAnnotationComplete: (annotatedImageDataUrl: string) => void;
  width?: number;
  height?: number;
}

type ShapeType = 'circle' | 'rectangle' | 'arrow' | 'pen';

interface Annotation {
  type: ShapeType;
  color: string;
  lineWidth: number;
  points: number[]; // [x, y, ...] different meanings for different shapes
}

// Circle: [centerX, centerY, radius]
// Rectangle: [x1, y1, x2, y2]
// Arrow: [startX, startY, endX, endY]
// Pen: [x1, y1, x2, y2, x3, y3, ...] (path points)

export function ImageAnnotationCanvas({
  imageDataUrl,
  onAnnotationComplete,
  width = 800,
  height = 600,
}: ImageAnnotationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [currentAnnotation, setCurrentAnnotation] = useState<Annotation | null>(null);
  const [shapeType, setShapeType] = useState<ShapeType>('circle');
  const [color, setColor] = useState('#FF0000');
  const [lineWidth, setLineWidth] = useState(3);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [penPath, setPenPath] = useState<number[]>([]);

  // Load image
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
      redrawCanvas();
    };
    img.src = imageDataUrl;
  }, [imageDataUrl]);

  // Redraw canvas
  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !imageRef.current) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw image
    ctx.drawImage(imageRef.current, 0, 0, canvas.width, canvas.height);

    // Draw all annotations
    annotations.forEach((annotation) => {
      ctx.strokeStyle = annotation.color;
      ctx.lineWidth = annotation.lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      switch (annotation.type) {
        case 'circle': {
          const [x, y, radius] = annotation.points;
          if (x !== undefined && y !== undefined && radius !== undefined) {
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, 2 * Math.PI);
            ctx.stroke();
          }
          break;
        }
        case 'rectangle': {
          const [x1, y1, x2, y2] = annotation.points;
          if (x1 !== undefined && y1 !== undefined && x2 !== undefined && y2 !== undefined) {
            ctx.beginPath();
            ctx.rect(x1, y1, x2 - x1, y2 - y1);
            ctx.stroke();
          }
          break;
        }
        case 'arrow': {
          const [startX, startY, endX, endY] = annotation.points;
          if (startX !== undefined && startY !== undefined && endX !== undefined && endY !== undefined) {
            drawArrow(ctx, startX, startY, endX, endY);
          }
          break;
        }
        case 'pen': {
          if (annotation.points.length < 4) break;
          const p0 = annotation.points[0];
          const p1 = annotation.points[1];
          if (p0 === undefined || p1 === undefined) break;
          ctx.beginPath();
          ctx.moveTo(p0, p1);
          for (let i = 2; i < annotation.points.length; i += 2) {
            const px = annotation.points[i];
            const py = annotation.points[i + 1];
            if (px !== undefined && py !== undefined) {
              ctx.lineTo(px, py);
            }
          }
          ctx.stroke();
          break;
        }
      }
    });
  };

  // Draw arrow helper
  const drawArrow = (
    ctx: CanvasRenderingContext2D,
    startX: number,
    startY: number,
    endX: number,
    endY: number
  ) => {
    const headLength = 20;
    const angle = Math.atan2(endY - startY, endX - startX);

    // Draw line
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    // Draw arrowhead
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(
      endX - headLength * Math.cos(angle - Math.PI / 6),
      endY - headLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.moveTo(endX, endY);
    ctx.lineTo(
      endX - headLength * Math.cos(angle + Math.PI / 6),
      endY - headLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.stroke();
  };

  useEffect(() => {
    if (imageLoaded) {
      redrawCanvas();
    }
  }, [annotations, imageLoaded]);

  // Get mouse position relative to canvas
  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);
    setIsDrawing(true);

    if (shapeType === 'pen') {
      setPenPath([pos.x, pos.y]);
      setCurrentAnnotation({
        type: 'pen',
        color,
        lineWidth,
        points: [pos.x, pos.y],
      });
    } else {
      setCurrentAnnotation({
        type: shapeType,
        color,
        lineWidth,
        points: [pos.x, pos.y],
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentAnnotation) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const pos = getMousePos(e);

    // Redraw everything
    redrawCanvas();

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (shapeType) {
      case 'circle': {
        const [startX, startY] = currentAnnotation.points;
        if (startX !== undefined && startY !== undefined) {
          const radius = Math.sqrt(
            Math.pow(pos.x - startX, 2) + Math.pow(pos.y - startY, 2)
          );
          ctx.beginPath();
          ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
          ctx.stroke();
        }
        break;
      }
      case 'rectangle': {
        const [startX, startY] = currentAnnotation.points;
        if (startX !== undefined && startY !== undefined) {
          ctx.beginPath();
          ctx.rect(startX, startY, pos.x - startX, pos.y - startY);
          ctx.stroke();
        }
        break;
      }
      case 'arrow': {
        const [startX, startY] = currentAnnotation.points;
        if (startX !== undefined && startY !== undefined) {
          drawArrow(ctx, startX, startY, pos.x, pos.y);
        }
        break;
      }
      case 'pen': {
        const newPath = [...penPath, pos.x, pos.y];
        setPenPath(newPath);
        const p0 = penPath[0];
        const p1 = penPath[1];
        if (p0 !== undefined && p1 !== undefined) {
          ctx.beginPath();
          ctx.moveTo(p0, p1);
          for (let i = 2; i < newPath.length; i += 2) {
            const px = newPath[i];
            const py = newPath[i + 1];
            if (px !== undefined && py !== undefined) {
              ctx.lineTo(px, py);
            }
          }
          ctx.stroke();
        }
        break;
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentAnnotation) return;

    const pos = getMousePos(e);
    let finalAnnotation: Annotation | null = null;

    switch (shapeType) {
      case 'circle': {
        const [startX, startY] = currentAnnotation.points;
        if (startX !== undefined && startY !== undefined) {
          const radius = Math.sqrt(
            Math.pow(pos.x - startX, 2) + Math.pow(pos.y - startY, 2)
          );
          if (radius > 5) {
            finalAnnotation = {
              type: 'circle',
              color,
              lineWidth,
              points: [startX, startY, radius],
            };
          }
        }
        break;
      }
      case 'rectangle': {
        const [startX, startY] = currentAnnotation.points;
        if (startX !== undefined && startY !== undefined) {
          const width = Math.abs(pos.x - startX);
          const height = Math.abs(pos.y - startY);
          if (width > 5 && height > 5) {
            finalAnnotation = {
              type: 'rectangle',
              color,
              lineWidth,
              points: [startX, startY, pos.x, pos.y],
            };
          }
        }
        break;
      }
      case 'arrow': {
        const [startX, startY] = currentAnnotation.points;
        if (startX !== undefined && startY !== undefined) {
          const length = Math.sqrt(
            Math.pow(pos.x - startX, 2) + Math.pow(pos.y - startY, 2)
          );
          if (length > 10) {
            finalAnnotation = {
              type: 'arrow',
              color,
              lineWidth,
              points: [startX, startY, pos.x, pos.y],
            };
          }
        }
        break;
      }
      case 'pen': {
        if (penPath.length > 4) {
          finalAnnotation = {
            type: 'pen',
            color,
            lineWidth,
            points: penPath,
          };
        }
        setPenPath([]);
        break;
      }
    }

    if (finalAnnotation) {
      setAnnotations([...annotations, finalAnnotation]);
    }

    setIsDrawing(false);
    setCurrentAnnotation(null);
  };

  const handleUndo = () => {
    if (annotations.length > 0) {
      setAnnotations(annotations.slice(0, -1));
    }
  };

  const handleClear = () => {
    setAnnotations([]);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Get annotated image as data URL
    const annotatedImageDataUrl = canvas.toDataURL('image/png');
    onAnnotationComplete(annotatedImageDataUrl);
  };

  return (
    <div className="space-y-4">
      {/* Canvas */}
      <div className="relative bg-muted rounded-lg overflow-hidden border-2 border-border">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            if (isDrawing) {
              setIsDrawing(false);
              setCurrentAnnotation(null);
              setPenPath([]);
            }
          }}
          className="w-full h-auto cursor-crosshair"
          style={{ maxHeight: '70vh' }}
        />
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-muted-foreground">Loading image...</p>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="space-y-3">
        {/* Shape Selection */}
        <div className="flex items-center gap-2">
          <Label className="text-sm">Tool:</Label>
          <ToggleGroup type="single" value={shapeType} onValueChange={(value) => value && setShapeType(value as ShapeType)}>
            <ToggleGroupItem value="circle" aria-label="Circle" title="Draw Circle">
              <Circle className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="rectangle" aria-label="Rectangle" title="Draw Rectangle">
              <Square className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="arrow" aria-label="Arrow" title="Draw Arrow">
              <ArrowRight className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="pen" aria-label="Free Draw" title="Free Draw">
              <Pen className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
          <span className="text-xs text-muted-foreground">
            {shapeType === 'circle' && 'Click & drag from center'}
            {shapeType === 'rectangle' && 'Click & drag to draw box'}
            {shapeType === 'arrow' && 'Click & drag to point'}
            {shapeType === 'pen' && 'Click & drag to draw freely'}
          </span>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          {/* Color Picker */}
          <div className="flex items-center gap-2">
            <Label className="text-sm">Color:</Label>
            <div className="flex gap-1">
              {['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'].map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    color === c
                      ? 'border-foreground scale-110 ring-2 ring-offset-2 ring-foreground'
                      : 'border-muted-foreground/25 hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>

          {/* Line Width Slider */}
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Label className="text-sm whitespace-nowrap">Thickness:</Label>
            <Slider
              value={[lineWidth]}
              onValueChange={(value) => setLineWidth(value[0] || 3)}
              min={1}
              max={10}
              step={1}
              className="flex-1"
            />
            <span className="text-sm text-muted-foreground w-8">{lineWidth}px</span>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleUndo}
              disabled={annotations.length === 0}
              title="Undo last annotation"
            >
              <Undo className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
              disabled={annotations.length === 0}
              title="Clear all annotations"
            >
              <Eraser className="h-4 w-4" />
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleSave}
              disabled={annotations.length === 0}
              title="Use annotated image"
            >
              Use Annotated Image ({annotations.length})
            </Button>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg space-y-1">
        <p className="font-medium">How to use:</p>
        <p>• <strong>Circle</strong>: Click center and drag to set radius</p>
        <p>• <strong>Rectangle</strong>: Click corner and drag to opposite corner</p>
        <p>• <strong>Arrow</strong>: Click start point and drag to end point</p>
        <p>• <strong>Pen</strong>: Click and drag to draw freehand</p>
        <p className="mt-2 text-primary">💡 Annotations help AI understand what to focus on. They will be automatically removed after processing.</p>
      </div>
    </div>
  );
}
