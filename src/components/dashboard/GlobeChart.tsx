import { useEffect, useRef } from 'react';

interface GlobePoint {
  lat: number;
  lng: number;
  label?: string;
  active?: boolean;
}

const TRADING_NODES: GlobePoint[] = [
  { lat: 40.7, lng: -74, label: "NYC", active: true },
  { lat: 51.5, lng: -0.1, label: "LON", active: true },
  { lat: 35.7, lng: 139.7, label: "TKY", active: true },
  { lat: 1.3, lng: 103.8, label: "SGP", active: true },
  { lat: -33.9, lng: 151.2, label: "SYD" },
  { lat: 22.3, lng: 114.2, label: "HKG", active: true },
  { lat: 37.6, lng: 127, label: "SEL" },
  { lat: 19.1, lng: 72.9, label: "MUM" },
  { lat: 55.8, lng: 37.6, label: "MOW" },
  { lat: -23.5, lng: -46.6, label: "SAO" },
  { lat: 25.2, lng: 55.3, label: "DXB", active: true },
  { lat: 48.9, lng: 2.3, label: "PAR" },
];

function projectPoint(lat: number, lng: number, rotation: number, size: number) {
  const radLat = (lat * Math.PI) / 180;
  const radLng = ((lng + rotation) * Math.PI) / 180;
  const r = size / 2;

  const x = r * Math.cos(radLat) * Math.sin(radLng);
  const y = -r * Math.sin(radLat);
  const z = r * Math.cos(radLat) * Math.cos(radLng);

  const scale = (r + z) / (2 * r);
  const px = size / 2 + x;
  const py = size / 2 + y;

  return { x: px, y: py, z, scale, visible: z > -r * 0.2 };
}

export const GlobeChart = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotationRef = useRef(0);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = 280;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    const draw = () => {
      ctx.clearRect(0, 0, size, size);
      rotationRef.current += 0.15;
      const rot = rotationRef.current;

      // Globe outline
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(220, 38, 38, 0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Latitude lines
      for (let lat = -60; lat <= 60; lat += 30) {
        ctx.beginPath();
        for (let lng = 0; lng <= 360; lng += 3) {
          const p = projectPoint(lat, lng, rot, size - 4);
          if (p.visible) {
            if (lng === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          }
        }
        ctx.strokeStyle = `rgba(220, 38, 38, 0.08)`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // Longitude lines
      for (let lng = 0; lng < 360; lng += 30) {
        ctx.beginPath();
        for (let lat = -90; lat <= 90; lat += 3) {
          const p = projectPoint(lat, lng, rot, size - 4);
          if (p.visible) {
            if (lat === -90) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          }
        }
        ctx.strokeStyle = `rgba(220, 38, 38, 0.08)`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // Draw trading nodes
      const sortedNodes = TRADING_NODES
        .map(node => ({ ...node, ...projectPoint(node.lat, node.lng, rot, size - 4) }))
        .filter(n => n.visible)
        .sort((a, b) => a.z - b.z);

      sortedNodes.forEach(node => {
        const dotSize = 2 + node.scale * 2;
        const alpha = 0.3 + node.scale * 0.7;

        // Glow
        if (node.active) {
          const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, dotSize * 4);
          gradient.addColorStop(0, `rgba(220, 38, 38, ${alpha * 0.4})`);
          gradient.addColorStop(1, 'rgba(220, 38, 38, 0)');
          ctx.beginPath();
          ctx.arc(node.x, node.y, dotSize * 4, 0, Math.PI * 2);
          ctx.fillStyle = gradient;
          ctx.fill();
        }

        // Dot
        ctx.beginPath();
        ctx.arc(node.x, node.y, dotSize, 0, Math.PI * 2);
        ctx.fillStyle = node.active
          ? `rgba(220, 38, 38, ${alpha})`
          : `rgba(160, 160, 160, ${alpha * 0.5})`;
        ctx.fill();

        // Label
        if (node.label && node.scale > 0.6) {
          ctx.font = `${9 * node.scale + 2}px "JetBrains Mono", monospace`;
          ctx.fillStyle = `rgba(220, 38, 38, ${alpha * 0.8})`;
          ctx.fillText(node.label, node.x + dotSize + 4, node.y + 3);
        }
      });

      // Connection lines between active nodes
      const activeVisible = sortedNodes.filter(n => n.active);
      for (let i = 0; i < activeVisible.length; i++) {
        for (let j = i + 1; j < activeVisible.length; j++) {
          const a = activeVisible[i];
          const b = activeVisible[j];
          const dist = Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
          if (dist < size * 0.6) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(220, 38, 38, ${0.06 * Math.min(a.scale, b.scale)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  return (
    <div className="relative flex items-center justify-center">
      <canvas ref={canvasRef} className="opacity-90" />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center">
          <div className="text-xs font-mono text-primary/60 uppercase tracking-widest">Global</div>
          <div className="text-xs font-mono text-muted-foreground">Trading Network</div>
        </div>
      </div>
    </div>
  );
};
