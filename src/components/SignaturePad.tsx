import { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface SignaturePadProps {
    onSave: (blob: Blob) => void;
    // onCancel removed as unused
}

export function SignaturePad({ onSave }: SignaturePadProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasSignature, setHasSignature] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            // Set canvas size (simple approach: use offsetWidth/Height)
            // Ideally we wait for layout, but for now simple init
            setTimeout(() => {
                if (canvas.parentElement) {
                     canvas.width = canvas.parentElement.offsetWidth;
                     canvas.height = 300;
                     const ctx = canvas.getContext('2d');
                     if (ctx) {
                        ctx.lineWidth = 2;
                        ctx.lineCap = 'round';
                        ctx.strokeStyle = 'black';
                     }
                }
            }, 100);
        }
    }, []);

    const getPos = (e: React.MouseEvent | React.TouchEvent | any) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        
        let clientX, clientY;
        
        if ('touches' in e) {
             clientX = e.touches[0].clientX;
             clientY = e.touches[0].clientY;
        } else {
             clientX = (e as React.MouseEvent).clientX;
             clientY = (e as React.MouseEvent).clientY;
        }

        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        setIsDrawing(true);
        const ctx = canvasRef.current?.getContext('2d');
        const pos = getPos(e);
        ctx?.beginPath();
        ctx?.moveTo(pos.x, pos.y);
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return;
        const ctx = canvasRef.current?.getContext('2d');
        const pos = getPos(e);
        ctx?.lineTo(pos.x, pos.y);
        ctx?.stroke();
        setHasSignature(true);
        // e.preventDefault(); 
    };

    const stopDrawing = () => {
        setIsDrawing(false);
        const ctx = canvasRef.current?.getContext('2d');
        ctx?.closePath();
    };

    const clear = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            setHasSignature(false);
        }
    };

    const handleSave = () => {
        canvasRef.current?.toBlob((blob) => {
            if (blob) onSave(blob);
        });
    };

    return (
        <div className="w-full space-y-4">
            <div className="border border-gray-300 rounded-md bg-white touch-none">
                <canvas
                    ref={canvasRef}
                    className="w-full h-[300px] cursor-crosshair block"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                />
            </div>
            <div className="flex justify-between items-center text-sm text-muted-foreground">
                <p>Tanda tangan di area di atas.</p>
                <div className="space-x-2">
                    <Button type="button" variant="outline" onClick={clear}>Hapus</Button>
                    <Button type="button" onClick={handleSave} disabled={!hasSignature}>Simpan</Button>
                </div>
            </div>
        </div>
    );
}
