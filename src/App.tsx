import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  Activity,
  Box,
  Layers,
  BarChart3,
} from 'lucide-react';

// Types
interface Point {
  x: number;
  y: number;
}

type Grid = boolean[][];

// Constants
const GRID_SIZE = 151;
const CENTER = Math.floor(GRID_SIZE / 2);

// Step definitions
const STEPS = [
  {
    id: 0,
    title: '무작위 걸음',
    subtitle: 'Random Walk',
    icon: Activity,
  },
  {
    id: 1,
    title: 'DLA 응집',
    subtitle: 'Diffusion-Limited Aggregation',
    icon: Layers,
  },
  {
    id: 2,
    title: '박스 카운팅',
    subtitle: 'Box Counting Dimension',
    icon: Box,
  },
  {
    id: 3,
    title: '공간 충전 분석',
    subtitle: 'Spatial Filling Efficiency',
    icon: BarChart3,
  },
];

// Helper functions
const createEmptyGrid = (): Grid => {
  return Array(GRID_SIZE)
    .fill(null)
    .map(() => Array(GRID_SIZE).fill(false));
};

const initializeDLA = (): Grid => {
  const grid = createEmptyGrid();
  grid[CENTER][CENTER] = true;
  return grid;
};

const getRandomDirection = (): Point => {
  const directions = [
    { x: 0, y: -1 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
  ];
  return directions[Math.floor(Math.random() * 4)];
};

const isInBounds = (x: number, y: number): boolean => {
  return x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE;
};

const hasNeighbor = (grid: Grid, x: number, y: number): boolean => {
  const neighbors = [
    { x: x - 1, y },
    { x: x + 1, y },
    { x, y: y - 1 },
    { x, y: y + 1 },
  ];
  return neighbors.some(({ x: nx, y: ny }) => isInBounds(nx, ny) && grid[ny][nx]);
};

// Custom hook for DLA simulation
const useDLASimulation = () => {
  const [grid, setGrid] = useState<Grid>(initializeDLA);
  const [isRunning, setIsRunning] = useState(false);
  const [particleCount, setParticleCount] = useState(1);
  const animRef = useRef<number | null>(null);
  const gridRef = useRef<Grid>(grid);
  const countRef = useRef(particleCount);

  useEffect(() => {
    gridRef.current = grid;
  }, [grid]);

  useEffect(() => {
    countRef.current = particleCount;
  }, [particleCount]);

  const spawnParticle = useCallback((): Point => {
    const angle = Math.random() * 2 * Math.PI;
    const radius = Math.floor(GRID_SIZE * 0.45);
    return {
      x: Math.floor(CENTER + radius * Math.cos(angle)),
      y: Math.floor(CENTER + radius * Math.sin(angle)),
    };
  }, []);

  const runSimulation = useCallback(() => {
    const particle = spawnParticle();
    let x = particle.x;
    let y = particle.y;
    let steps = 0;
    const maxSteps = 50000;

    while (steps < maxSteps) {
      if (!isInBounds(x, y)) break;

      if (hasNeighbor(gridRef.current, x, y)) {
        const newGrid = gridRef.current.map((row) => [...row]);
        newGrid[y][x] = true;
        gridRef.current = newGrid;
        setGrid(newGrid);
        setParticleCount((prev) => {
          const newCount = prev + 1;
          countRef.current = newCount;
          return newCount;
        });
        return true;
      }

      const dir = getRandomDirection();
      x += dir.x;
      y += dir.y;
      steps++;
    }
    return false;
  }, [spawnParticle]);

  useEffect(() => {
    if (!isRunning) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      return;
    }

    let lastTime = 0;
    const interval = 16;

    const animate = (time: number) => {
      if (time - lastTime >= interval) {
        for (let i = 0; i < 12; i++) {
          runSimulation();
        }
        lastTime = time;
      }
      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isRunning, runSimulation]);

  const reset = useCallback(() => {
    setIsRunning(false);
    const newGrid = initializeDLA();
    setGrid(newGrid);
    gridRef.current = newGrid;
    setParticleCount(1);
    countRef.current = 1;
  }, []);

  return { grid, isRunning, particleCount, setIsRunning, reset };
};

// 올림(Math.ceil) 및 대칭 여백 오프셋을 적용한 박스 카운팅 알고리즘
const calculateBoxCounting = (grid: Grid): { sizes: number[]; counts: number[] } => {
  const sizes: number[] = [];
  const counts: number[] = [];

  for (let boxSize = 2; boxSize <= GRID_SIZE / 2; boxSize *= 2) {
    let count = 0;
    const numBoxes = Math.ceil(GRID_SIZE / boxSize);
    const totalGridWidth = numBoxes * boxSize;
    const offset = Math.floor((totalGridWidth - GRID_SIZE) / 2);

    for (let bx = 0; bx < numBoxes; bx++) {
      for (let by = 0; by < numBoxes; by++) {
        let hasParticle = false;
        for (let dx = 0; dx < boxSize && !hasParticle; dx++) {
          for (let dy = 0; dy < boxSize && !hasParticle; dy++) {
            const x = bx * boxSize + dx - offset;
            const y = by * boxSize + dy - offset;
            if (isInBounds(x, y) && grid[y][x]) {
              hasParticle = true;
            }
          }
        }
        if (hasParticle) count++;
      }
    }
    sizes.push(boxSize);
    counts.push(count);
  }

  return { sizes, counts };
};

// Linear regression
const linearRegression = (points: { x: number; y: number }[]): { slope: number; intercept: number } => {
  const n = points.length;
  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumX2 = 0;

  points.forEach(({ x, y }) => {
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  });

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
};

// Canvas components
const DLACanvas = ({ grid, width = 400 }: { grid: Grid; width?: number }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = width;
    const cellSize = size / GRID_SIZE;

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = '#22d3ee';
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (grid[y][x]) {
          ctx.beginPath();
          ctx.arc(x * cellSize + cellSize / 2, y * cellSize + cellSize / 2, cellSize * 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.45, 0, Math.PI * 2);
    ctx.stroke();
  }, [grid, width]);

  return <canvas ref={canvasRef} width={width} height={width} className="rounded-lg shadow-xl" />;
};

// 박스 카운팅 연산 오프셋과 동기화되어 입자를 100% 가두는 캔버스 렌더러
const BoxCountingCanvas = ({
  grid,
  boxSize,
  width = 400,
}: {
  grid: Grid;
  boxSize: number;
  width?: number;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = width;
    const cellSize = size / GRID_SIZE;

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, size, size);

    const numBoxes = Math.ceil(GRID_SIZE / boxSize);
    const totalGridWidth = numBoxes * boxSize;
    const offset = Math.floor((totalGridWidth - GRID_SIZE) / 2);

    for (let bx = 0; bx < numBoxes; bx++) {
      for (let by = 0; by < numBoxes; by++) {
        let hasParticle = false;
        for (let dx = 0; dx < boxSize && !hasParticle; dx++) {
          for (let dy = 0; dy < boxSize && !hasParticle; dy++) {
            const x = bx * boxSize + dx - offset;
            const y = by * boxSize + dy - offset;
            if (isInBounds(x, y) && grid[y][x]) {
              hasParticle = true;
            }
          }
        }

        if (hasParticle) {
          ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
          ctx.fillRect(
            (bx * boxSize - offset) * cellSize, 
            (by * boxSize - offset) * cellSize, 
            boxSize * cellSize, 
            boxSize * cellSize
          );
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
          ctx.strokeRect(
            (bx * boxSize - offset) * cellSize, 
            (by * boxSize - offset) * cellSize, 
            boxSize * cellSize, 
            boxSize * cellSize
          );
        }
      }
    }

    ctx.fillStyle = '#22d3ee';
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (grid[y][x]) {
          ctx.beginPath();
          ctx.arc(x * cellSize + cellSize / 2, y * cellSize + cellSize / 2, cellSize * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }, [grid, boxSize, width]);

  return <canvas ref={canvasRef} width={width} height={width} className="rounded-lg shadow-xl" />;
};

// Step Components
const RandomWalkStep = () => {
  const [particles, setParticles] = useState<Point[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setParticles((prev) =>
        prev.map((p) => {
          const dir = getRandomDirection();
          return { x: p.x + dir.x, y: p.y + dir.y };
        })
      );

      if (Math.random() < 0.1) {
        setParticles((prev) => [...prev, { x: CENTER, y: CENTER }]);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [isRunning]);

  useEffect(() => {
    if (particles.length === 0) {
      setParticles([
        { x: CENTER, y: CENTER },
        { x: CENTER + 10, y: CENTER },
        { x: CENTER - 10, y: CENTER },
      ]);
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 400;
    const cellSize = size / GRID_SIZE;

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = '#1e3a5f';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID_SIZE; i += 10) {
      ctx.beginPath();
      ctx.moveTo(i * cellSize, 0);
      ctx.lineTo(i * cellSize, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * cellSize);
      ctx.lineTo(size, i * cellSize);
      ctx.stroke();
    }

    particles.forEach((p, idx) => {
      const colors = ['#22d3ee', '#a855f7', '#f97316', '#22c55e'];
      ctx.fillStyle = colors[idx % colors.length];
      ctx.beginPath();
      ctx.arc(p.x * cellSize, p.y * cellSize, cellSize * 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = colors[idx % colors.length] + '40';
      ctx.beginPath();
      ctx.arc(p.x * cellSize, p.y * cellSize, cellSize * 4, 0, Math.PI * 2);
      ctx.fill();
    });
  }, [particles]);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-4">무작위 걸음 시뮬레이션</h2>
        <p className="text-gray-400">각 입자는 매 순간 독립적으로 1/4 확률로 동, 서, 남, 북 중 하나로 이동</p>
      </div>

      <div className="flex justify-center mb-6">
        <canvas ref={canvasRef} width={400} height={400} className="rounded-lg shadow-xl" />
      </div>

      <div className="flex justify-center gap-4">
        <button
          onClick={() => setIsRunning(!isRunning)}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
            isRunning
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-cyan-600 hover:bg-cyan-700 text-white'
          }`}
        >
          {isRunning ? <Pause size={20} /> : <Play size={20} />}
          {isRunning ? '정지' : '시작'}
        </button>
        <button
          onClick={() => {
            setIsRunning(false);
            setParticles([
              { x: CENTER, y: CENTER },
              { x: CENTER + 10, y: CENTER },
              { x: CENTER - 10, y: CENTER },
            ]);
          }}
          className="flex items-center gap-2 px-6 py-3 rounded-lg bg-gray-600 hover:bg-gray-700 text-white font-medium transition-all"
        >
          <RotateCcw size={20} />
          초기화
        </button>
      </div>

      <div className="mt-6 p-4 bg-gray-800/50 rounded-lg">
        <p className="text-gray-300 text-center">
          입자 수: <span className="text-cyan-400 font-mono">{particles.length}</span>
        </p>
      </div>
    </div>
  );
};

const DLAStep = () => {
  const { grid, isRunning, particleCount, setIsRunning, reset } = useDLASimulation();

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-4">DLA 응집 시뮬레이션</h2>
        <p className="text-gray-400">무작위 걸음을 하는 입자들이 중심핵에 닿는 순간 결합하며 프랙탈 구조 형성</p>
      </div>

      <div className="flex justify-center mb-6">
        <DLACanvas grid={grid} />
      </div>

      <div className="flex justify-center gap-4">
        <button
          onClick={() => setIsRunning(!isRunning)}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
            isRunning
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-cyan-600 hover:bg-cyan-700 text-white'
          }`}
        >
          {isRunning ? <Pause size={20} /> : <Play size={20} />}
          {isRunning ? '정지' : '시작'}
        </button>
        <button
          onClick={reset}
          className="flex items-center gap-2 px-6 py-3 rounded-lg bg-gray-600 hover:bg-gray-700 text-white font-medium transition-all"
        >
          <RotateCcw size={20} />
          초기화
        </button>
      </div>

      <div className="mt-6 p-4 bg-gray-800/50 rounded-lg">
        <p className="text-gray-300 text-center">
          응집 입자 수: <span className="text-cyan-400 font-mono">{particleCount}</span>
        </p>
      </div>
    </div>
  );
};

// Linear Regression Graph Canvas (부호 오류 전면 수정)
// [원상복구] X축을 원래 이론 수식인 ln(1/ε)로 철저히 유지 (음수 축 좌표 보존)
const RegressionGraphCanvas = ({
  sizes,
  counts,
  width = 350,
  height = 280,
}: {
  sizes: number[];
  counts: number[];
  width?: number;
  height?: number;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const padding = 50;
    const graphWidth = width - padding * 2;
    const graphHeight = height - padding * 2;

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    // [이론식 유지] X축 변수는 정상적으로 ln(1/ε) 이므로 무조건 음수 영역 매핑
    const points = sizes.map((s, i) => ({
      x: Math.log(1 / s), // s=2 이면 -0.69, s=32 이면 -3.47
      y: Math.log(counts[i]),
    }));

    if (points.length < 2) return;

    const xMin = Math.min(...points.map((p) => p.x));
    const xMax = Math.max(...points.map((p) => p.x));
    const yMin = Math.min(...points.map((p) => p.y));
    const yMax = Math.max(...points.map((p) => p.y));

    const { slope, intercept } = linearRegression(points);

    const toCanvasX = (x: number) => padding + ((x - xMin) / (xMax - xMin)) * graphWidth;
    const toCanvasY = (y: number) => height - padding - ((y - yMin) / (yMax - yMin)) * graphHeight;

    // Y축 격자선
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = padding + (i * graphHeight) / 5;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();

      const yVal = yMax - (i * (yMax - yMin)) / 5;
      ctx.fillStyle = '#9ca3af';
      ctx.font = '11px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(yVal.toFixed(2), padding - 8, y + 4);
    }

    // X축 격자선 (축 눈금에 정상적으로 음수 범위가 표시됨)
    for (let i = 0; i <= 5; i++) {
      const x = padding + (i * graphWidth) / 5;
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, height - padding);
      ctx.stroke();

      const xVal = xMin + (i * (xMax - xMin)) / 5;
      ctx.fillStyle = '#9ca3af';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(xVal.toFixed(2), x, height - padding + 16);
    }

    // 회귀 추세선 렌더링 (원래대로 좌하향에서 우상향하는 양의 기울기)
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    const lineX1 = xMin;
    const lineY1 = slope * lineX1 + intercept;
    const lineX2 = xMax;
    const lineY2 = slope * lineX2 + intercept;
    ctx.beginPath();
    ctx.moveTo(toCanvasX(lineX1), toCanvasY(lineY1));
    ctx.lineTo(toCanvasX(lineX2), toCanvasY(lineY2));
    ctx.stroke();
    ctx.setLineDash([]);

    // 플롯 데이터 포인트 찍기
    points.forEach((p) => {
      const cx = toCanvasX(p.x);
      const cy = toCanvasY(p.y);

      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#0891b2';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // 축 수식 안내 환원
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ln(1/ε)', width / 2, height - 8);

    ctx.save();
    ctx.translate(12, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('ln N(ε)', 0, 0);
    ctx.restore();

    // 우측 상단 프랙탈 차원 D 출력 (양의 기울기가 곧 차원 D)
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(`D = ${slope.toFixed(4)}`, width - padding - 50, padding - 10);
  }, [sizes, counts, width, height]);

  return <canvas ref={canvasRef} width={width} height={height} className="rounded-lg shadow-xl" />;
};

const BOX_SIZES = [2, 4, 8, 16, 32] as const;

const BoxCountingStep = () => {
  const { grid, isRunning, particleCount, setIsRunning, reset } = useDLASimulation();
  const [boxSize, setBoxSize] = useState<number>(8);
  const [fractalDim, setFractalDim] = useState<number | null>(null);
  const [boxData, setBoxData] = useState<{ sizes: number[]; counts: number[] }>({ sizes: [], counts: [] });
  const [filteredData, setFilteredData] = useState<{ sizes: number[]; counts: number[] }>({ sizes: [], counts: [] });

  useEffect(() => {
    if (particleCount > 50) {
      const { sizes, counts } = calculateBoxCounting(grid);
      setBoxData({ sizes, counts });
    }
  }, [grid, particleCount]);

  useEffect(() => {
    if (boxData.sizes.length === 0) return;

    const maxIndex = boxData.sizes.findIndex((s) => s === boxSize);
    if (maxIndex === -1) return;

    const filteredSizes = boxData.sizes.slice(0, maxIndex + 1);
    const filteredCounts = boxData.counts.slice(0, maxIndex + 1);
    setFilteredData({ sizes: filteredSizes, counts: filteredCounts });

    if (filteredSizes.length >= 2) {
      // [이론식 유지] 내부 선형 회귀 알고리즘 좌표계도 ln(1/s) 음수 축으로 정상 복구
      const points = filteredSizes.map((s, i) => ({
        x: Math.log(1 / s),
        y: Math.log(filteredCounts[i]),
      }));
      const { slope } = linearRegression(points);
      setFractalDim(slope); // 양의 기울기 값 그대로 차원에 바인딩
    }
  }, [boxData, boxSize]);

  useEffect(() => {
    setIsRunning(true);
    return () => setIsRunning(false);
  }, [setIsRunning]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-4">박스 카운팅 차원 계산</h2>
        <p className="text-gray-400">격자 크기를 변화시키며 입자가 포함된 박스 수를 계산하고 선형 회귀 분석으로 차원 도출</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        <div>
          <BoxCountingCanvas grid={grid} boxSize={boxSize} width={350} />
          <div className="bg-gray-800/80 rounded-xl p-4 mt-4">
            <h3 className="text-sm font-semibold text-white mb-3">박스 크기 선택</h3>
            <div className="flex gap-2 flex-wrap">
              {BOX_SIZES.map((size) => (
                <button
                  key={size}
                  onClick={() => setBoxSize(size)}
                  className={`px-4 py-2 rounded-lg font-mono text-sm font-medium transition-all ${
                    boxSize === size
                      ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/30'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  ε = {size}
                </button>
              ))}
            </div>
            <p className="text-gray-400 text-xs mt-3 text-center">
              선택한 크기까지의 데이터로 회귀 분석
            </p>
          </div>
        </div>

        <div className="flex flex-col">
          <div className="bg-gray-800/80 rounded-xl p-4 mb-4">
            <h3 className="text-sm font-semibold text-white mb-2">선형 회귀 분석 그래프</h3>
            <p className="text-gray-400 text-xs">ln N(ε) = D × ln(1/ε) + C</p>
          </div>
          <RegressionGraphCanvas sizes={filteredData.sizes} counts={filteredData.counts} width={350} height={280} />
        </div>

        <div className="flex flex-col gap-4">
          <div className="bg-gradient-to-br from-cyan-900/40 to-cyan-800/20 rounded-xl p-6 border border-cyan-700/30">
            <h3 className="text-lg font-semibold text-white mb-3">계산된 프랙탈 차원</h3>
            {fractalDim ? (
              <p className="text-4xl font-bold text-cyan-400 text-center font-mono">
                D ≈ {fractalDim.toFixed(3)}
              </p>
            ) : (
              <p className="text-gray-500 text-center">시뮬레이션 진행 중...</p>
            )}
            <p className="text-gray-400 text-sm text-center mt-2">이론값: D ≈ 1.71</p>
            <p className="text-gray-500 text-xs text-center mt-1">데이터 포인트: {filteredData.sizes.length}개</p>
          </div>

          <div className="bg-gray-800/80 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white mb-3">박스 카운팅 데이터</h3>
            <div className="space-y-2 text-xs font-mono">
              {boxData.sizes.map((size, idx) => {
                const isIncluded = size <= boxSize;
                return (
                  <div
                    key={size}
                    className={`flex justify-between ${isIncluded ? 'text-gray-300' : 'text-gray-600'}`}
                  >
                    <span className={isIncluded ? 'text-cyan-400' : ''}>ε = {size.toString().padStart(2)}</span>
                    <span>N(ε) = {boxData.counts[idx]}</span>
                    {/* [데이터 테이블 수정] 축과 연동되면서 우측에 깔끔하게 표기되는 양수의 ln(ε) 값 */}
                    <span className={isIncluded ? 'text-cyan-400' : 'text-gray-600'}>
                      ln(ε) = {Math.log(size).toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-center gap-4 mb-4">
        <button
          onClick={() => setIsRunning(!isRunning)}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
            isRunning
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-cyan-600 hover:bg-cyan-700 text-white'
          }`}
        >
          {isRunning ? <Pause size={20} /> : <Play size={20} />}
          {isRunning ? '정지' : '시작'}
        </button>
        <button
          onClick={() => {
            reset();
            setFractalDim(null);
            setBoxData({ sizes: [], counts: [] });
            setFilteredData({ sizes: [], counts: [] });
          }}
          className="flex items-center gap-2 px-6 py-3 rounded-lg bg-gray-600 hover:bg-gray-700 text-white font-medium transition-all"
        >
          <RotateCcw size={20} />
          초기화
        </button>
      </div>

      <div className="p-4 bg-gray-800/50 rounded-lg">
        <p className="text-gray-300 text-center">
          총 입자 수: <span className="text-cyan-400 font-mono">{particleCount}</span>
        </p>
      </div>
    </div>
  );
};

const SpatialFillingStep = () => {
  const { grid, particleCount } = useDLASimulation();

  const solidRadius = Math.sqrt(particleCount / Math.PI);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-4">공간 충전 효율 비교</h2>
        <p className="text-gray-400">DLA 구조와 꽉 찬 원의 공간 점유 방식 비교</p>
      </div>

      <div className="flex flex-wrap justify-center gap-8 mb-8">
        <div className="text-center">
          <DLACanvas grid={grid} width={300} />
          <h3 className="text-lg font-semibold text-cyan-400 mt-4">DLA 구조</h3>
          <p className="text-gray-400 text-sm">공간을 엉성하게 채움</p>
        </div>

        <svg width="300" height="300" className="rounded-lg shadow-xl bg-gray-900">
          <circle cx="150" cy="150" r={Math.min(solidRadius * 3, 130)} fill="#22d3ee" opacity="0.8" />
          <text x="150" y="150" textAnchor="middle" fill="white" className="text-sm">
            꽉 찬 2차원 원
          </text>
        </svg>
      </div>

      <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        <div className="bg-gradient-to-br from-cyan-900/30 to-cyan-800/10 rounded-xl p-6 border border-cyan-700/30">
          <h3 className="text-xl font-semibold text-cyan-400 mb-4">DLA 특성</h3>
          <ul className="space-y-3 text-gray-300">
            <li className="flex items-start gap-2">
              <span className="text-cyan-500 mt-1">•</span>
              <span>차원: 약 1.71 (소수점 차원)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cyan-500 mt-1">•</span>
              <span>높은 표면적/부피 비율</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cyan-500 mt-1">•</span>
              <span>공기 저항 큼 → 대기 중 장기 잔류</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cyan-500 mt-1">•</span>
              <span>계면 접촉 면적 넓음 → 강력한 흡착</span>
            </li>
          </ul>
        </div>

        <div className="bg-gradient-to-br from-gray-800/50 to-gray-700/30 rounded-xl p-6 border border-gray-600/30">
          <h3 className="text-xl font-semibold text-gray-300 mb-4">꽉 찬 2차원 원</h3>
          <ul className="space-y-3 text-gray-300">
            <li className="flex items-start gap-2">
              <span className="text-gray-500 mt-1">•</span>
              <span>차원: 정확히 2.0</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-500 mt-1">•</span>
              <span>최소 표면적/부피 비율</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-500 mt-1">•</span>
              <span>공기 저항 최소화</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-500 mt-1">•</span>
              <span>구형 입자와 유사</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-8 max-w-2xl mx-auto">
        <h3 className="text-xl font-semibold text-white mb-4 text-center">실제 응용 분야</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-4 bg-orange-900/20 rounded-lg border border-orange-700/30">
            <h4 className="font-semibold text-orange-400 mb-2">미세먼지 거동</h4>
            <p className="text-gray-400 text-sm">
              낮은 차원으로 인해 공기 저항이 커 대기 중에 오랫동안 떠다님
            </p>
          </div>
          <div className="p-4 bg-purple-900/20 rounded-lg border border-purple-700/30">
            <h4 className="font-semibold text-purple-400 mb-2">에어로졸 화장품</h4>
            <p className="text-gray-400 text-sm">
              넓은 표면적으로 피부와의 접촉 면적이 증가하여 밀착력 향상
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main App
function App() {
  const [currentStep, setCurrentStep] = useState(0);

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <RandomWalkStep />;
      case 1:
        return <DLAStep />;
      case 2:
        return <BoxCountingStep />;
      case 3:
        return <SpatialFillingStep />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <header className="border-b border-gray-700/50 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                프랙탈 차원 시뮬레이터
              </h1>
              <p className="text-gray-400 text-sm">미세먼지·에어로졸 응집 메커니즘 분석</p>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2">
            {STEPS.map((step, idx) => {
              const Icon = step.icon;
              return (
                <button
                  key={step.id}
                  onClick={() => setCurrentStep(idx)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all whitespace-nowrap ${
                    currentStep === idx
                      ? 'bg-gradient-to-r from-cyan-600 to-purple-600 text-white shadow-lg'
                      : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'
                  }`}
                >
                  <Icon size={18} />
                  <div className="text-left">
                    <div className="text-sm font-medium">{step.title}</div>
                    <div className="text-xs opacity-75">{step.subtitle}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="min-h-[600px]">{renderStep()}</div>

        <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-700/50">
          <button
            onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
            disabled={currentStep === 0}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
              currentStep === 0
                ? 'bg-gray-800/30 text-gray-600 cursor-not-allowed'
                : 'bg-gray-700 hover:bg-gray-600 text-white'
            }`}
          >
            <ChevronLeft size={20} />
            이전 단계
          </button>

          <div className="flex gap-2">
            {STEPS.map((_, idx) => (
              <div
                key={idx}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === currentStep ? 'bg-cyan-400 w-4' : 'bg-gray-600'
                }`}
              />
            ))}
          </div>

          <button
            onClick={() => setCurrentStep((s) => Math.min(STEPS.length - 1, s + 1))}
            disabled={currentStep === STEPS.length - 1}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
              currentStep === STEPS.length - 1
                ? 'bg-gray-800/30 text-gray-600 cursor-not-allowed'
                : 'bg-cyan-600 hover:bg-cyan-700 text-white'
            }`}
          >
            다음 단계
            <ChevronRight size={20} />
          </button>
        </div>
      </main>

      <footer className="border-t border-gray-700/50 mt-8 py-6">
        <div className="max-w-6xl mx-auto px-4 text-center text-gray-500 text-sm">
          <p>프랙탈 차원을 이용한 미세먼지, 에어로졸의 응집 메커니즘과 공간 충전 분석</p>
        </div>
      </footer>
    </div>
  );
}

export default App;